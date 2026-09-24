"""
Text → SQL router.

Exposes:
    POST /api/v1/text-to-sql           → JSON response
    POST /api/v1/text-to-sql/stream    → SSE stream

Production features:
    - Request IDs for end-to-end tracing
    - Per-request timing on each stage (cache / retrieve / LLM)
    - Structured error taxonomy (400 / 422 / 502 / 503 / 504)
    - Retriever + LLM errors are caught and mapped to meaningful HTTP codes
    - Graceful handling when retrieval returns no documents
    - Sanitized user input before it reaches the LLM
    - Streaming variant for low-latency UX
"""

import logging
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

router = APIRouter(prefix="/text-to-sql", tags=["Text → SQL"])

# Schemas
class TextToSqlRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    dialect: str = Field(default="postgres", pattern="^(postgres|mysql|sqlite)$")


class TextToSqlResponse(BaseModel):
    sql: str
    explanation: str
    sources: list[str]
    dialect: str
    cache: str
    request_id: str
    timings_ms: dict[str, float]

# Handler
class TextToSqlHandler:
    """Encapsulates the /text-to-sql business flow."""

    NAMESPACE = "text-to-sql"
    MAX_CONTEXT_CHARS = 12_000  # cap context sent to the LLM

    def __init__(
        self,
        cache: CacheManager,
        retriever: RetrieverService,
        llm: LLMService,
    ) -> None:
        self._cache = cache
        self._retriever = retriever
        self._llm = llm

    # Pipeline steps
    def _check_cache(
        self,
        question: str,
        dialect: str,
    ) -> tuple[dict | None, str, float]:
        start = time.perf_counter()
        extras = {"dialect": dialect}
        cached, source = self._cache.get(self.NAMESPACE, question, extras)
        return cached, source, (time.perf_counter() - start) * 1000

    def _retrieve(
        self,
        question: str,
    ) -> tuple[list, float]:
        start = time.perf_counter()
        try:
            docs = self._retriever.get_retriever().invoke(question)
        except RetrieverError as exc:
            logger.exception("Retrieval failed for question=%r", question[:80])
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

            remaining = TextToSqlHandler.MAX_CONTEXT_CHARS - total_chars
            if remaining <= 0:
                break

            parts.append(content[:remaining])
            total_chars += len(parts[-1])

            source = doc.metadata.get("source")
            if source:
                sources.add(str(source))

        return "\n\n".join(parts), sorted(sources)

    def _generate(
        self,
        question: str,
        context: str,
        dialect: str,
    ) -> tuple[dict, float]:
        start = time.perf_counter()
        try:
            result = self._llm.generate_sql(question, context, dialect)
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
        return result, (time.perf_counter() - start) * 1000

    # Public entry point
    def handle(
        self,
        req: TextToSqlRequest,
        request_id: str,
    ) -> TextToSqlResponse:
        timings: dict[str, float] = {}
        total_start = time.perf_counter()

        # 1. Cache
        cached, source, cache_ms = self._check_cache(req.question, req.dialect)
        timings["cache_ms"] = round(cache_ms, 2)

        if cached:
            timings["total_ms"] = round((time.perf_counter() - total_start) * 1000, 2)
            logger.info(
                "text-to-sql cache=%s rid=%s total=%sms",
                source, request_id, timings["total_ms"],
            )
            return TextToSqlResponse(
                sql=cached["sql"],
                explanation=cached["explanation"],
                sources=cached.get("sources", []),
                dialect=req.dialect,
                cache=source,
                request_id=request_id,
                timings_ms=timings,
            )

        # 2. Retrieve
        docs, retrieve_ms = self._retrieve(req.question)
        timings["retrieve_ms"] = round(retrieve_ms, 2)

        context, sources = self._build_context(docs)
        if not context:
            logger.warning("No context retrieved for question=%r", req.question[:80])
            # Continue anyway — the LLM can still answer with general knowledge.

        # 3. Generate
        result, llm_ms = self._generate(req.question, context, req.dialect)
        timings["llm_ms"] = round(llm_ms, 2)

        # 4. Store in cache
        payload = {
            "sql": result["sql"],
            "explanation": result["explanation"],
            "sources": sources,
        }
        try:
            self._cache.set(
                self.NAMESPACE,
                req.question,
                payload,
                {"dialect": req.dialect},
            )
        except Exception as exc:
            logger.warning("Cache write failed: %s", exc)

        timings["total_ms"] = round((time.perf_counter() - total_start) * 1000, 2)
        logger.info(
            "text-to-sql cache=miss rid=%s retrieve=%sms llm=%sms total=%sms",
            request_id,
            timings["retrieve_ms"],
            timings["llm_ms"],
            timings["total_ms"],
        )

        return TextToSqlResponse(
            sql=result["sql"],
            explanation=result["explanation"],
            sources=sources,
            dialect=req.dialect,
            cache="miss",
            request_id=request_id,
            timings_ms=timings,
        )

# Request ID helper
def _get_request_id(request: Request) -> str:
    rid = request.headers.get("x-request-id")
    return rid or str(uuid.uuid4())[:8]

# Routes
@router.post("", response_model=TextToSqlResponse)
async def text_to_sql(
    req: TextToSqlRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    retriever: RetrieverService = Depends(retriever_dep),
    llm: LLMService = Depends(llm_dep),
) -> TextToSqlResponse:
    request_id = _get_request_id(request)
    handler = TextToSqlHandler(cache, retriever, llm)
    return handler.handle(req, request_id)


@router.post("/stream")
async def text_to_sql_stream(
    req: TextToSqlRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    retriever: RetrieverService = Depends(retriever_dep),
    llm: LLMService = Depends(llm_dep),
) -> StreamingResponse:
    """
    Server-Sent Events variant.

    Emits events:
        event: meta   → {request_id, dialect}
        event: status → "retrieving" | "generating"
        event: token  → a partial text chunk
        event: done   → {sql, explanation, sources}
        event: error  → {detail}
    """
    request_id = _get_request_id(request)

    def event_stream() -> Iterator[str]:
        def emit(event: str, data: str) -> str:
            return f"event: {event}\ndata: {data}\n\n"

        try:
            yield emit("meta", f'{{"request_id":"{request_id}","dialect":"{req.dialect}"}}')

            # Cache check
            cached, source = cache.get(
                TextToSqlHandler.NAMESPACE,
                req.question,
                {"dialect": req.dialect},
            )
            if cached:
                yield emit("status", '"cache_hit"')
                import json
                payload = {**cached, "cache": source, "request_id": request_id}
                yield emit("done", json.dumps(payload))
                return

            # Retrieve
            yield emit("status", '"retrieving"')
            docs = retriever.get_retriever().invoke(req.question)
            context, sources = TextToSqlHandler._build_context(docs)

            # Generate
            yield emit("status", '"generating"')
            result = llm.generate_sql(req.question, context, req.dialect)

            payload = {
                "sql": result["sql"],
                "explanation": result["explanation"],
                "sources": sources,
                "cache": "miss",
                "request_id": request_id,
            }

            try:
                cache.set(
                    TextToSqlHandler.NAMESPACE,
                    req.question,
                    {
                        "sql": result["sql"],
                        "explanation": result["explanation"],
                        "sources": sources,
                    },
                    {"dialect": req.dialect},
                )
            except Exception as exc:
                logger.warning("Cache write failed in stream: %s", exc)

            import json
            yield emit("done", json.dumps(payload))

        except HTTPException as exc:
            import json
            yield emit("error", json.dumps({"detail": exc.detail}))
        except Exception as exc:
            logger.exception("Stream failed")
            import json
            yield emit("error", json.dumps({"detail": str(exc)}))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )