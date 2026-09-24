"""
SQL → Text router.

Exposes:
    POST /api/v1/sql-to-text           → JSON response
    POST /api/v1/sql-to-text/stream    → SSE stream

Production features:
    - Request IDs for end-to-end tracing
    - Per-stage timing (cache / retrieve / LLM)
    - Structured error taxonomy
    - Exact-match cache only (no semantic L3 — SQL is meaning-sensitive)
    - Deterministic keyword extraction for retrieval priming
    - Context cap to protect against huge retrievals
    - Streaming variant for low-latency UX
"""

import json
import logging
import re
import time
import uuid
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.routes.dependencies import cache_dep, llm_dep, retriever_dep
from app.services.cache import CacheManager
from app.services.llm import (
    LLMError,
    LLMResponseError,
    LLMService,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.services.retriever import RetrieverError, RetrieverService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sql-to-text", tags=["SQL → Text"])


# Schemas
class SqlToTextRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=5000)


class LineExplanation(BaseModel):
    line: str
    explanation: str


class SqlToTextResponse(BaseModel):
    summary: str
    line_by_line: list[LineExplanation]
    tips: list[str]
    sources: list[str]
    cache: str
    request_id: str
    timings_ms: dict[str, float]


# Keyword extraction
class SQLKeywordExtractor:
    """
    Extracts SQL clauses from a query to prime the retriever.

    Multi-word keywords are matched first (longest-match wins), then
    single-word clauses. Order in the output is deterministic so cache
    keys stay stable across runs.
    """

    MULTI_WORD: tuple[str, ...] = (
        "LEFT OUTER JOIN",
        "RIGHT OUTER JOIN",
        "FULL OUTER JOIN",
        "LEFT JOIN",
        "RIGHT JOIN",
        "INNER JOIN",
        "OUTER JOIN",
        "CROSS JOIN",
        "NATURAL JOIN",
        "GROUP BY",
        "ORDER BY",
        "PARTITION BY",
        "UNION ALL",
        "IS NOT NULL",
        "IS NULL",
        "NOT IN",
        "NOT EXISTS",
    )

    SINGLE_WORD: tuple[str, ...] = (
        "JOIN", "WHERE", "HAVING", "LIMIT", "OFFSET",
        "UNION", "INTERSECT", "EXCEPT", "WITH", "OVER",
        "CASE", "COALESCE", "NULLIF", "EXISTS", "IN",
        "DISTINCT", "SELECT", "INSERT", "UPDATE", "DELETE",
        "RETURNING", "WITH RECURSIVE", "LATERAL",
        "WINDOW", "FILTER", "RETURNING",
    )

    def extract(self, sql: str) -> str:
        upper = sql.upper()

        hits: list[str] = []
        consumed_spans: list[tuple[int, int]] = []

        # Multi-word first
        for kw in self.MULTI_WORD:
            idx = upper.find(kw)
            if idx == -1:
                continue
            # Skip if this span overlaps an already matched one
            if any(s <= idx < e or s < idx + len(kw) <= e
                   for s, e in consumed_spans):
                continue
            hits.append(kw)
            consumed_spans.append((idx, idx + len(kw)))

        # Single-word next
        for kw in self.SINGLE_WORD:
            for match in re.finditer(rf"\b{re.escape(kw)}\b", upper):
                idx = match.start()
                if any(s <= idx < e for s, e in consumed_spans):
                    continue
                hits.append(kw)
                consumed_spans.append((idx, idx + len(kw)))

        if not hits:
            # Fall back to first 200 chars of the SQL for a retrieval signal
            return sql[:200]

        # Deduplicate while preserving order
        seen: set[str] = set()
        ordered: list[str] = []
        for kw in hits:
            if kw not in seen:
                seen.add(kw)
                ordered.append(kw)

        return " ".join(ordered)

# Handler
class SqlToTextHandler:
    """Encapsulates the /sql-to-text business flow."""

    NAMESPACE = "sql-to-text"
    MAX_CONTEXT_CHARS = 12_000

    def __init__(
        self,
        cache: CacheManager,
        retriever: RetrieverService,
        llm: LLMService,
    ) -> None:
        self._cache = cache
        self._retriever = retriever
        self._llm = llm
        self._extractor = SQLKeywordExtractor()

    # Pipeline steps
    def _check_cache(self, sql: str) -> tuple[dict | None, str, float]:
        """
        Exact-match lookup only — semantic cache is disabled for SQL input
        because a one-word change (GROUP BY → ORDER BY) alters meaning.
        """
        start = time.perf_counter()
        cached, source = self._cache.get_exact(self.NAMESPACE, sql)
        return cached, source, (time.perf_counter() - start) * 1000

    def _retrieve(self, sql: str) -> tuple[list, float]:
        start = time.perf_counter()
        query = self._extractor.extract(sql)

        try:
            docs = self._retriever.get_retriever().invoke(query)
        except RetrieverError as exc:
            logger.exception("Retrieval failed for sql=%r", sql[:80])
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Retrieval service unavailable: {exc}",
            )
        except Exception as exc:
            logger.exception("Unexpected retrieval error")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Retrieval failed unexpectedly.",
            )

        return docs, (time.perf_counter() - start) * 1000

    @staticmethod
    def _build_context(docs: list) -> tuple[str, list[str]]:
        if not docs:
            return "", []

        parts: list[str] = []
        sources: set[str] = set()
        total_chars = 0

        for doc in docs:
            content = doc.page_content.strip()
            if not content:
                continue

            remaining = SqlToTextHandler.MAX_CONTEXT_CHARS - total_chars
            if remaining <= 0:
                break

            parts.append(content[:remaining])
            total_chars += len(parts[-1])

            source = doc.metadata.get("source")
            if source:
                sources.add(str(source))

        return "\n\n".join(parts), sorted(sources)

    def _explain(self, sql: str, context: str) -> tuple[dict, float]:
        start = time.perf_counter()

        try:
            result = self._llm.explain_sql(sql, context)
        except LLMTimeoutError as exc:
            logger.warning("LLM timeout: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="The model took too long to respond. Please try again.",
            )
        except LLMUnavailableError as exc:
            logger.error("LLM unavailable: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The language model is currently unavailable.",
            )
        except LLMResponseError as exc:
            logger.warning("Malformed LLM response: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The model returned an invalid response.",
            )
        except LLMError as exc:
            logger.exception("LLM error")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM failed: {exc}",
            )

        # Normalize the shape — line_by_line may be a list of dicts or strings.
        line_by_line = []
        for entry in result.get("line_by_line", []) or []:
            if isinstance(entry, dict):
                line_by_line.append({
                    "line": str(entry.get("line", "")),
                    "explanation": str(entry.get("explanation", "")),
                })
            elif isinstance(entry, str):
                line_by_line.append({"line": "", "explanation": entry})

        return {
            "summary": str(result.get("summary", "") or ""),
            "line_by_line": line_by_line,
            "tips": [str(t) for t in (result.get("tips") or [])],
        }, (time.perf_counter() - start) * 1000

    # Public entry point
    def handle(
        self,
        req: SqlToTextRequest,
        request_id: str,
    ) -> SqlToTextResponse:
        timings: dict[str, float] = {}
        total_start = time.perf_counter()

        # 1. Cache
        cached, source, cache_ms = self._check_cache(req.sql)
        timings["cache_ms"] = round(cache_ms, 2)

        if cached:
            timings["total_ms"] = round(
                (time.perf_counter() - total_start) * 1000, 2,
            )
            logger.info(
                "sql-to-text cache=%s rid=%s total=%sms",
                source, request_id, timings["total_ms"],
            )
            return SqlToTextResponse(
                summary=cached.get("summary", ""),
                line_by_line=[
                    LineExplanation(**e) for e in cached.get("line_by_line", [])
                ],
                tips=cached.get("tips", []),
                sources=cached.get("sources", []),
                cache=source,
                request_id=request_id,
                timings_ms=timings,
            )

        # 2. Retrieve
        docs, retrieve_ms = self._retrieve(req.sql)
        timings["retrieve_ms"] = round(retrieve_ms, 2)

        context, sources = self._build_context(docs)
        if not context:
            logger.warning("No context retrieved for sql=%r", req.sql[:80])

        # 3. Explain
        result, llm_ms = self._explain(req.sql, context)
        timings["llm_ms"] = round(llm_ms, 2)

        # 4. Cache (exact only)
        payload = {
            "summary": result["summary"],
            "line_by_line": result["line_by_line"],
            "tips": result["tips"],
            "sources": sources,
        }
        try:
            self._cache.set_exact(self.NAMESPACE, req.sql, payload)
        except Exception as exc:
            logger.warning("Cache write failed: %s", exc)

        timings["total_ms"] = round((time.perf_counter() - total_start) * 1000, 2)
        logger.info(
            "sql-to-text cache=miss rid=%s retrieve=%sms llm=%sms total=%sms",
            request_id,
            timings["retrieve_ms"],
            timings["llm_ms"],
            timings["total_ms"],
        )

        return SqlToTextResponse(
            summary=result["summary"],
            line_by_line=[LineExplanation(**e) for e in result["line_by_line"]],
            tips=result["tips"],
            sources=sources,
            cache="miss",
            request_id=request_id,
            timings_ms=timings,
        )

# Request ID helper
def _get_request_id(request: Request) -> str:
    rid = request.headers.get("x-request-id")
    return rid or str(uuid.uuid4())[:8]


# Routes
@router.post("", response_model=SqlToTextResponse)
async def sql_to_text(
    req: SqlToTextRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    retriever: RetrieverService = Depends(retriever_dep),
    llm: LLMService = Depends(llm_dep),
) -> SqlToTextResponse:
    request_id = _get_request_id(request)
    handler = SqlToTextHandler(cache, retriever, llm)
    return handler.handle(req, request_id)


@router.post("/stream")
async def sql_to_text_stream(
    req: SqlToTextRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    retriever: RetrieverService = Depends(retriever_dep),
    llm: LLMService = Depends(llm_dep),
) -> StreamingResponse:
    """
    SSE variant.

    Events:
        meta   → {request_id}
        status → "cache_hit" | "retrieving" | "explaining"
        done   → full SqlToTextResponse payload
        error  → {detail}
    """
    request_id = _get_request_id(request)
    handler = SqlToTextHandler(cache, retriever, llm)

    def event_stream() -> Iterator[str]:
        def emit(event: str, data: str) -> str:
            return f"event: {event}\ndata: {data}\n\n"

        try:
            yield emit("meta", json.dumps({"request_id": request_id}))

            cached, source = cache.get_exact(SqlToTextHandler.NAMESPACE, req.sql)
            if cached:
                yield emit("status", '"cache_hit"')
                yield emit("done", json.dumps({
                    **cached,
                    "cache": source,
                    "request_id": request_id,
                }))
                return

            yield emit("status", '"retrieving"')
            docs, _ = handler._retrieve(req.sql)
            context, sources = handler._build_context(docs)

            yield emit("status", '"explaining"')
            result, _ = handler._explain(req.sql, context)

            payload = {
                "summary": result["summary"],
                "line_by_line": result["line_by_line"],
                "tips": result["tips"],
                "sources": sources,
                "cache": "miss",
                "request_id": request_id,
            }

            try:
                cache.set_exact(SqlToTextHandler.NAMESPACE, req.sql, {
                    "summary": result["summary"],
                    "line_by_line": result["line_by_line"],
                    "tips": result["tips"],
                    "sources": sources,
                })
            except Exception as exc:
                logger.warning("Cache write failed in stream: %s", exc)

            yield emit("done", json.dumps(payload))

        except HTTPException as exc:
            yield emit("error", json.dumps({"detail": exc.detail}))
        except Exception as exc:
            logger.exception("Stream failed")
            yield emit("error", json.dumps({"detail": str(exc)}))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )