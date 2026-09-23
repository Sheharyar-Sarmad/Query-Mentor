"""
RetrieverService — production-grade Pinecone + embeddings manager.

Features:
    - Thread-safe lazy loading of expensive resources
    - Retries with exponential backoff on transient Pinecone errors
    - Bounded wait when creating an index (no infinite loops)
    - Multiple search modes: MMR, similarity, similarity-with-score
    - Namespace and metadata filter support
    - Batched embedding to respect rate limits
    - Structured logging
    - Health check + diagnostics
    - Process-wide usage metrics

IMPORTANT:
    DEFAULT_NAMESPACE must match the namespace used by IngestionService,
    otherwise retrieval returns zero documents. Both default to
    "sql_reference".
"""

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config.settings import Settings, settings as global_settings

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────
# Errors
# ────────────────────────────────────────────────────────────

class RetrieverError(Exception):
    """Base error for retrieval failures."""


class IndexNotReadyError(RetrieverError):
    """Pinecone index did not become ready in time."""


class EmbeddingError(RetrieverError):
    """Embedding generation failed."""


# ────────────────────────────────────────────────────────────
# Metrics
# ────────────────────────────────────────────────────────────

@dataclass
class RetrievalMetrics:
    """Per-process retrieval metrics."""
    searches: int = 0
    searches_with_hits: int = 0
    total_docs_retrieved: int = 0
    total_latency_ms: float = 0.0
    embed_calls: int = 0
    errors: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def record_search(self, docs: int, latency_ms: float) -> None:
        with self._lock:
            self.searches += 1
            self.total_latency_ms += latency_ms
            self.total_docs_retrieved += docs
            if docs > 0:
                self.searches_with_hits += 1

    def record_embed(self) -> None:
        with self._lock:
            self.embed_calls += 1

    def record_error(self) -> None:
        with self._lock:
            self.errors += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            avg_latency = self.total_latency_ms / self.searches if self.searches else 0.0
            hit_rate = self.searches_with_hits / self.searches if self.searches else 0.0
            avg_docs = self.total_docs_retrieved / self.searches if self.searches else 0.0
            return {
                "searches": self.searches,
                "hit_rate": round(hit_rate, 3),
                "avg_docs_per_search": round(avg_docs, 2),
                "avg_latency_ms": round(avg_latency, 1),
                "embed_calls": self.embed_calls,
                "errors": self.errors,
            }


# ────────────────────────────────────────────────────────────
# RetrieverService
# ────────────────────────────────────────────────────────────

class RetrieverService:
    """Thread-safe Pinecone + embeddings manager."""

    INDEX_READY_TIMEOUT = 120   # seconds
    INDEX_POLL_INTERVAL = 2     # seconds
    MAX_EMBED_BATCH = 64        # texts per embedding call

    # MUST match IngestionService.DEFAULT_NAMESPACE
    DEFAULT_NAMESPACE = "sql_reference"

    def __init__(self, config: Optional[Settings] = None) -> None:
        self._settings = config or global_settings

        # Lazy-loaded resources + their locks
        self._embeddings: Optional[FastEmbedEmbeddings] = None
        self._embeddings_lock = threading.Lock()

        self._pinecone: Optional[Pinecone] = None
        self._pinecone_lock = threading.Lock()

        self._index = None
        self._index_lock = threading.Lock()

        self._vector_store: Optional[PineconeVectorStore] = None
        self._vector_store_lock = threading.Lock()

        # Metrics
        self.metrics = RetrievalMetrics()

    # ────────────────────────────────────────────────────────
    # Lazy-loaded resources
    # ────────────────────────────────────────────────────────

    @property
    def embeddings(self) -> FastEmbedEmbeddings:
        if self._embeddings is None:
            with self._embeddings_lock:
                if self._embeddings is None:
                    logger.info(
                        "Loading embedding model: %s",
                        self._settings.EMBEDDING_MODEL,
                    )
                    start = time.perf_counter()
                    self._embeddings = FastEmbedEmbeddings(
                        model_name=self._settings.EMBEDDING_MODEL,
                    )
                    elapsed = (time.perf_counter() - start) * 1000
                    logger.info("Embedding model loaded in %.0f ms", elapsed)
        return self._embeddings

    @property
    def pinecone(self) -> Pinecone:
        if self._pinecone is None:
            with self._pinecone_lock:
                if self._pinecone is None:
                    logger.info("Connecting to Pinecone")
                    self._pinecone = Pinecone(api_key=self._settings.PINECONE_API_KEY)
        return self._pinecone

    @property
    def index(self):
        if self._index is None:
            with self._index_lock:
                if self._index is None:
                    self._index = self._get_or_create_index()
        return self._index

    @property
    def vector_store(self) -> PineconeVectorStore:
        if self._vector_store is None:
            with self._vector_store_lock:
                if self._vector_store is None:
                    self._vector_store = PineconeVectorStore(
                        index=self.index,
                        embedding=self.embeddings,
                    )
        return self._vector_store

    # ────────────────────────────────────────────────────────
    # Index management
    # ────────────────────────────────────────────────────────

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
    )
    def _list_index_names(self) -> list[str]:
        return [i["name"] for i in self.pinecone.list_indexes()]

    def _get_or_create_index(self):
        name = self._settings.PINECONE_INDEX_NAME

        try:
            existing = self._list_index_names()
        except Exception as exc:
            logger.exception("Failed to list Pinecone indexes")
            raise RetrieverError(f"Cannot reach Pinecone: {exc}") from exc

        if name not in existing:
            logger.info("Creating Pinecone index '%s'", name)
            try:
                self.pinecone.create_index(
                    name=name,
                    dimension=self._settings.EMBEDDING_DIM,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud=self._settings.PINECONE_CLOUD,
                        region=self._settings.PINECONE_REGION,
                    ),
                )
            except Exception as exc:
                logger.exception("Failed to create index")
                raise RetrieverError(f"Index creation failed: {exc}") from exc

            self._wait_for_index_ready(name)

        return self.pinecone.Index(name)

    def _wait_for_index_ready(self, name: str) -> None:
        """Poll until the index is ready or the timeout elapses."""
        deadline = time.monotonic() + self.INDEX_READY_TIMEOUT
        while time.monotonic() < deadline:
            try:
                status = self.pinecone.describe_index(name).status
                if status.get("ready"):
                    logger.info("Index '%s' is ready", name)
                    return
            except Exception as exc:
                logger.warning("Polling index status failed: %s", exc)

            time.sleep(self.INDEX_POLL_INTERVAL)

        raise IndexNotReadyError(
            f"Index '{name}' did not become ready within "
            f"{self.INDEX_READY_TIMEOUT}s"
        )

    # ────────────────────────────────────────────────────────
    # Search modes
    # ────────────────────────────────────────────────────────

    def get_retriever(
        self,
        search_type: str = "mmr",
        k: Optional[int] = None,
        fetch_k: Optional[int] = None,
        lambda_mult: Optional[float] = None,
        namespace: Optional[str] = None,
        filter: Optional[dict] = None,
    ):
        """
        Return a retriever configured for the requested search type.

        If no namespace is provided, defaults to DEFAULT_NAMESPACE so
        retrieval matches the namespace IngestionService writes to.
        """
        search_kwargs: dict[str, Any] = {
            "k": k or self._settings.RETRIEVER_K,
            "namespace": namespace or self.DEFAULT_NAMESPACE,
        }

        if search_type == "mmr":
            search_kwargs["fetch_k"] = fetch_k or self._settings.RETRIEVER_FETCH_K
            search_kwargs["lambda_mult"] = (
                lambda_mult if lambda_mult is not None
                else self._settings.RETRIEVER_LAMBDA
            )
        elif search_type not in ("similarity", "similarity_score_threshold"):
            raise ValueError(
                f"Unsupported search_type '{search_type}'. "
                f"Use 'mmr' or 'similarity'."
            )

        if filter:
            search_kwargs["filter"] = filter

        return self.vector_store.as_retriever(
            search_type=search_type,
            search_kwargs=search_kwargs,
        )

    def search(
        self,
        query: str,
        k: Optional[int] = None,
        namespace: Optional[str] = None,
        filter: Optional[dict] = None,
    ) -> list:
        """Direct similarity search with metrics + structured error handling."""
        start = time.perf_counter()
        k = k or self._settings.RETRIEVER_K

        try:
            kwargs: dict[str, Any] = {
                "k": k,
                "namespace": namespace or self.DEFAULT_NAMESPACE,
            }
            if filter:
                kwargs["filter"] = filter

            docs = self.vector_store.similarity_search(query, **kwargs)
        except Exception as exc:
            self.metrics.record_error()
            logger.exception("Search failed")
            raise RetrieverError(f"Search failed: {exc}") from exc

        latency_ms = (time.perf_counter() - start) * 1000
        self.metrics.record_search(len(docs), latency_ms)

        if not docs:
            logger.debug("No documents matched query: %s", query[:80])

        return docs

    def search_with_score(
        self,
        query: str,
        k: Optional[int] = None,
        namespace: Optional[str] = None,
        filter: Optional[dict] = None,
    ) -> list[tuple[Any, float]]:
        """Similarity search returning (doc, score) pairs."""
        start = time.perf_counter()
        k = k or self._settings.RETRIEVER_K

        try:
            kwargs: dict[str, Any] = {
                "k": k,
                "namespace": namespace or self.DEFAULT_NAMESPACE,
            }
            if filter:
                kwargs["filter"] = filter

            results = self.vector_store.similarity_search_with_score(query, **kwargs)
        except Exception as exc:
            self.metrics.record_error()
            logger.exception("Scored search failed")
            raise RetrieverError(f"Scored search failed: {exc}") from exc

        latency_ms = (time.perf_counter() - start) * 1000
        self.metrics.record_search(len(results), latency_ms)
        return results

    # ────────────────────────────────────────────────────────
    # Embedding (batched)
    # ────────────────────────────────────────────────────────

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts with progress logging."""
        if not texts:
            return []

        vectors: list[list[float]] = []
        total = len(texts)

        for start in range(0, total, self.MAX_EMBED_BATCH):
            batch = texts[start : start + self.MAX_EMBED_BATCH]
            try:
                vectors.extend(self.embeddings.embed_documents(batch))
                self.metrics.record_embed()
            except Exception as exc:
                self.metrics.record_error()
                logger.exception("Embedding batch failed at index %d", start)
                raise EmbeddingError(f"Embedding failed: {exc}") from exc

            if start % (self.MAX_EMBED_BATCH * 4) == 0:
                logger.debug("Embedded %d / %d texts", start + len(batch), total)

        return vectors

    # ────────────────────────────────────────────────────────
    # Health / diagnostics
    # ────────────────────────────────────────────────────────

    def health(self) -> dict[str, Any]:
        """Return a lightweight health report — safe to call from /health."""
        report: dict[str, Any] = {
            "embeddings_loaded": self._embeddings is not None,
            "pinecone_connected": self._pinecone is not None,
            "index_ready": False,
            "vector_count": None,
            "namespace_count": None,
            "default_namespace": self.DEFAULT_NAMESPACE,
            "metrics": self.metrics.snapshot(),
        }

        try:
            stats = self.index.describe_index_stats()
            report["index_ready"] = True
            report["vector_count"] = getattr(stats, "total_vector_count", None)
            namespaces = getattr(stats, "namespaces", {}) or {}
            report["namespace_count"] = len(namespaces)
            report["namespaces"] = {
                name: ns.get("vector_count", 0)
                for name, ns in namespaces.items()
            }
        except Exception as exc:
            report["error"] = str(exc)

        return report

    def warm_up(self) -> None:
        """Force-load all expensive resources — call at server startup."""
        start = time.perf_counter()
        _ = self.embeddings
        _ = self.vector_store
        elapsed = (time.perf_counter() - start) * 1000
        logger.info("RetrieverService warmed up in %.0f ms", elapsed)


# ────────────────────────────────────────────────────────────
# Thread-safe singleton
# ────────────────────────────────────────────────────────────

_retriever_instance: Optional[RetrieverService] = None
_retriever_lock = threading.Lock()


def get_retriever_service() -> RetrieverService:
    global _retriever_instance
    if _retriever_instance is None:
        with _retriever_lock:
            if _retriever_instance is None:
                _retriever_instance = RetrieverService()
    return _retriever_instance