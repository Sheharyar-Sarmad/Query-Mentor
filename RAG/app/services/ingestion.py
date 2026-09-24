"""
IngestionService — production-grade PDF ingestion into Pinecone.

Features:
    - Incremental: skips re-ingestion when PDF content is unchanged
    - Idempotent: safe to run multiple times
    - Cleans up stale vectors from previous versions before ingesting
    - Retries with exponential backoff on transient Pinecone errors
    - Progress tracking with batch + time estimates
    - Dry-run mode to preview without writing
    - Force-reingest flag for schema/metadata changes
    - Namespace support for multi-tenant knowledge bases
    - Structured logging
    - Chunk deduplication to avoid waste

CLI:
    python -m app.services.ingestion              # incremental
    python -m app.services.ingestion --force      # bypass version check
    python -m app.services.ingestion --dry-run    # no writes
    python -m app.services.ingestion --namespace sql_reference
"""

import argparse
import hashlib
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config.settings import Settings, settings as global_settings
from app.services.retriever import RetrieverService, get_retriever_service

logger = logging.getLogger(__name__)


# Errors
class IngestionError(Exception):
    """Base ingestion error."""


class PDFNotFoundError(IngestionError):
    """The source PDF is missing."""


class EmptyDocumentError(IngestionError):
    """PDF yielded no text — likely scanned images."""


# Stats
@dataclass
class IngestionStats:
    """Metrics recorded for a single ingestion run."""
    version: str = ""
    pdf_path: str = ""
    pages_loaded: int = 0
    chunks_created: int = 0
    chunks_after_dedup: int = 0
    chunks_uploaded: int = 0
    stale_deleted: int = 0
    duration_sec: float = 0.0
    skipped: bool = False
    dry_run: bool = False
    namespace: str = ""
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "pdf_path": self.pdf_path,
            "pages_loaded": self.pages_loaded,
            "chunks_created": self.chunks_created,
            "chunks_after_dedup": self.chunks_after_dedup,
            "chunks_uploaded": self.chunks_uploaded,
            "stale_deleted": self.stale_deleted,
            "duration_sec": round(self.duration_sec, 2),
            "skipped": self.skipped,
            "dry_run": self.dry_run,
            "namespace": self.namespace,
            "errors": self.errors,
        }


# IngestionService
class IngestionService:
    """Bulk ingestion of the SQL reference into Pinecone."""

    BATCH_SIZE: int = 100
    DEFAULT_NAMESPACE: str = "sql_reference"
    SOURCE_TAG: str = "sql_reference"

    def __init__(
        self,
        retriever: Optional[RetrieverService] = None,
        config: Optional[Settings] = None,
    ) -> None:
        self._retriever = retriever or get_retriever_service()
        self._settings = config or global_settings

    # Helpers
    @staticmethod
    def file_sha256(path: Path) -> str:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for block in iter(lambda: f.read(8192), b""):
                h.update(block)
        return h.hexdigest()[:12]

    def _build_splitter(self) -> RecursiveCharacterTextSplitter:
        return RecursiveCharacterTextSplitter(
            chunk_size=self._settings.CHUNK_SIZE,
            chunk_overlap=self._settings.CHUNK_OVERLAP,
            separators=[
                "\n## ",
                "\n### ",
                "\n```",
                "```",
                "\n\n",
                "\n",
                " ",
            ],
        )

    # Version tracking
    def _current_index_version(self, namespace: str) -> Optional[str]:
        """Read the version tag on existing vectors, or None if empty."""
        try:
            stats = self._retriever.index.describe_index_stats()
        except Exception as exc:
            logger.warning("Could not read index stats: %s", exc)
            return None

        ns_stats = (stats.get("namespaces") or {}).get(namespace)
        if not ns_stats or ns_stats.get("vector_count", 0) == 0:
            return None

        # Sample one vector's metadata to read its version field
        try:
            sample = self._retriever.index.query(
                vector=[0.0] * self._settings.EMBEDDING_DIM,
                top_k=1,
                namespace=namespace,
                include_metadata=True,
            )
            matches = getattr(sample, "matches", []) or []
            if matches:
                return matches[0].get("metadata", {}).get("version")
        except Exception as exc:
            logger.warning("Could not sample index version: %s", exc)

        return None

    def _delete_namespace(self, namespace: str) -> int:
        """Delete every vector in a namespace. Returns approximate count."""
        try:
            stats = self._retriever.index.describe_index_stats()
            ns_stats = (stats.get("namespaces") or {}).get(namespace) or {}
            count = ns_stats.get("vector_count", 0)

            if count == 0:
                return 0

            logger.info("Deleting %d stale vectors from namespace '%s'", count, namespace)
            self._retriever.index.delete(delete_all=True, namespace=namespace)
            return count
        except Exception as exc:
            logger.warning("Namespace delete failed: %s", exc)
            return 0

    # Load + chunk
    def load_and_chunk(self, pdf_path: Path, stats: IngestionStats) -> list[Document]:
        logger.info("Loading PDF: %s", pdf_path)
        start = time.perf_counter()

        try:
            pages = PyPDFLoader(str(pdf_path)).load()
        except Exception as exc:
            raise IngestionError(f"PDF load failed: {exc}") from exc

        stats.pages_loaded = len(pages)
        logger.info("Loaded %d pages in %.2fs", len(pages), time.perf_counter() - start)

        if not pages:
            raise EmptyDocumentError("PDF yielded no pages")

        total_chars = sum(len(p.page_content.strip()) for p in pages)
        if total_chars < 100:
            raise EmptyDocumentError(
                "PDF yielded almost no text — likely a scanned image PDF"
            )

        chunks = self._build_splitter().split_documents(pages)
        stats.chunks_created = len(chunks)
        logger.info("Split into %d chunks", len(chunks))

        return chunks

    def _deduplicate_chunks(self, chunks: list[Document]) -> list[Document]:
        """Drop chunks with identical content to avoid duplicate vectors."""
        seen: set[str] = set()
        unique: list[Document] = []

        for chunk in chunks:
            content = chunk.page_content.strip()
            if not content:
                continue
            fingerprint = hashlib.sha256(content.encode("utf-8")).hexdigest()
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            unique.append(chunk)

        return unique

    # Metadata
    def tag_metadata(
        self,
        chunks: list[Document],
        version: str,
        namespace: str,
    ) -> None:
        for i, chunk in enumerate(chunks):
            chunk.metadata.update({
                "source": self.SOURCE_TAG,
                "version": version,
                "chunk_index": i,
                "namespace": namespace,
            })

    # Upsert (with retries)
    def _make_store(self) -> PineconeVectorStore:
        return PineconeVectorStore(
            index=self._retriever.index,
            embedding=self._retriever.embeddings,
        )

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=20),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    )
    def _upsert_batch(self, store: PineconeVectorStore, batch, ids, namespace):
        store.add_documents(documents=batch, ids=ids, namespace=namespace)

    def upsert(
        self,
        chunks: list[Document],
        version: str,
        namespace: str,
        stats: IngestionStats,
    ) -> None:
        if not chunks:
            logger.warning("No chunks to upsert")
            return

        store = self._make_store()
        total = len(chunks)
        logger.info(
            "Upserting %d chunks to namespace '%s' (batch=%d)",
            total, namespace, self.BATCH_SIZE,
        )

        start = time.perf_counter()
        uploaded = 0

        for i in range(0, total, self.BATCH_SIZE):
            batch = chunks[i : i + self.BATCH_SIZE]
            ids = [
                f"chunk-{version}-{c.metadata['chunk_index']}"
                for c in batch
            ]

            try:
                self._upsert_batch(store, batch, ids, namespace)
            except Exception as exc:
                msg = f"Batch {i // self.BATCH_SIZE} failed: {exc}"
                logger.exception(msg)
                stats.errors.append(msg)
                continue

            uploaded += len(batch)
            elapsed = time.perf_counter() - start
            rate = uploaded / elapsed if elapsed > 0 else 0

            logger.info(
                "Progress: %d / %d chunks (%.1f chunks/s)",
                uploaded, total, rate,
            )

        stats.chunks_uploaded = uploaded
        logger.info(
            "Uploaded %d / %d chunks in %.1fs",
            uploaded, total, time.perf_counter() - start,
        )

    # Main entry point
    def run(
        self,
        pdf_path: Path,
        namespace: str = DEFAULT_NAMESPACE,
        force: bool = False,
        dry_run: bool = False,
    ) -> IngestionStats:
        stats = IngestionStats(
            pdf_path=str(pdf_path),
            namespace=namespace,
            dry_run=dry_run,
        )
        run_start = time.perf_counter()

        if not pdf_path.exists():
            raise PDFNotFoundError(f"Not found: {pdf_path}")

        version = self.file_sha256(pdf_path)
        stats.version = version
        os.environ["DOC_VERSION"] = version
        logger.info("PDF version: %s", version)

        # ── Incremental skip check
        existing = self._current_index_version(namespace)
        if existing and existing == version and not force:
            logger.info(
                "Index already at version %s — skipping (use --force to override)",
                version,
            )
            stats.skipped = True
            stats.duration_sec = time.perf_counter() - run_start
            return stats

        if existing and existing != version:
            logger.info(
                "Version change detected: %s → %s", existing, version,
            )

        # ── Warm up
        self._retriever.warm_up()

        # ── Load + chunk
        chunks = self.load_and_chunk(pdf_path, stats)

        # ── Deduplicate
        chunks = self._deduplicate_chunks(chunks)
        stats.chunks_after_dedup = len(chunks)
        logger.info("After dedup: %d chunks", len(chunks))

        if not chunks:
            raise IngestionError("No chunks produced after deduplication")

        # ── Tag metadata
        self.tag_metadata(chunks, version, namespace)

        # ── Dry run: stop here
        if dry_run:
            logger.info("Dry run: would upload %d chunks", len(chunks))
            stats.duration_sec = time.perf_counter() - run_start
            return stats

        # ── Clean up old version
        if existing and existing != version:
            stats.stale_deleted = self._delete_namespace(namespace)

        # ── Upsert
        self.upsert(chunks, version, namespace, stats)

        stats.duration_sec = time.perf_counter() - run_start
        logger.info(
            "Ingestion complete: %d chunks in %.1fs",
            stats.chunks_uploaded, stats.duration_sec,
        )
        return stats


# CLI
def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest the SQL reference PDF into Pinecone.",
    )
    parser.add_argument(
        "--pdf",
        type=Path,
        default=None,
        help="Path to the PDF (default: app/data/sql_reference.pdf)",
    )
    parser.add_argument(
        "--namespace",
        type=str,
        default=IngestionService.DEFAULT_NAMESPACE,
        help="Pinecone namespace (default: sql_reference)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if the version is unchanged",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and chunk, but do not upload",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    _configure_logging(args.verbose)

    pdf_path = args.pdf
    if pdf_path is None:
        data_dir = Path(__file__).resolve().parent.parent / "data"
        pdf_path = data_dir / "sql_reference.pdf"

    try:
        service = IngestionService()
        stats = service.run(
            pdf_path=pdf_path,
            namespace=args.namespace,
            force=args.force,
            dry_run=args.dry_run,
        )

        print("\n" + "=" * 60)
        print("  Ingestion Summary")
        print("=" * 60)
        for key, value in stats.to_dict().items():
            print(f"  {key:.<30} {value}")
        print("=" * 60)

        return 0

    except PDFNotFoundError as exc:
        logger.error("PDF missing: %s", exc)
        return 1
    except EmptyDocumentError as exc:
        logger.error("Empty document: %s", exc)
        return 2
    except IngestionError as exc:
        logger.error("Ingestion failed: %s", exc)
        return 3
    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
        return 130
    except Exception as exc:
        logger.exception("Unexpected error: %s", exc)
        return 4


if __name__ == "__main__":
    sys.exit(main())