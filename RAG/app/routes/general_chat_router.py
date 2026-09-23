"""
General chat router — greetings, small talk, general SQL questions.

Exposes:
    POST /api/v1/chat           → JSON response (buffered)
    POST /api/v1/chat/stream    → SSE token stream (recommended for UI)

Production features:
    - Request IDs for tracing
    - Per-stage timing (cache / LLM)
    - Real token-level streaming from Groq
    - Structured error taxonomy
    - Semantic cache is ENABLED here — English input, paraphrases are safe
    - Message length caps, sanitized before reaching the LLM
"""

import json
import logging
import time
import uuid
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.routes.dependencies import cache_dep, llm_dep
from app.services.cache import CacheManager
from app.services.llm import (
    LLMError,
    LLMResponseError,
    LLMService,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["General Chat"])


# ────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    reply: str
    cache: str
    request_id: str
    timings_ms: dict[str, float]


# ────────────────────────────────────────────────────────────
# Handler
# ────────────────────────────────────────────────────────────

class GeneralChatHandler:
    """Encapsulates the /chat business flow."""

    NAMESPACE = "general-chat"

    def __init__(self, cache: CacheManager, llm: LLMService) -> None:
        self._cache = cache
        self._llm = llm

    # ────────────────────────────────────────────────────────
    # Cache
    # ────────────────────────────────────────────────────────

    def _check_cache(self, message: str) -> tuple[dict | None, str, float]:
        """
        Semantic cache is enabled for this namespace because user input is
        natural English — paraphrases like "hi" and "hello" should share a
        cached reply. See SEMANTIC_NAMESPACES in CacheManager.
        """
        start = time.perf_counter()
        cached, source = self._cache.get(self.NAMESPACE, message)
        return cached, source, (time.perf_counter() - start) * 1000

    def _store_cache(self, message: str, reply: str) -> None:
        try:
            self._cache.set(self.NAMESPACE, message, {"reply": reply})
        except Exception as exc:
            logger.warning("Cache write failed: %s", exc)

    # ────────────────────────────────────────────────────────
    # LLM
    # ────────────────────────────────────────────────────────

    def _generate(self, message: str) -> tuple[str, float]:
        start = time.perf_counter()

        try:
            reply = self._llm.chat(message)
        except LLMTimeoutError as exc:
            logger.warning("Chat timeout: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="The model took too long to respond.",
            )
        except LLMUnavailableError as exc:
            logger.error("Chat LLM unavailable: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The language model is currently unavailable.",
            )
        except LLMResponseError as exc:
            logger.warning("Chat malformed response: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The model returned an invalid response.",
            )
        except LLMError as exc:
            logger.exception("Chat LLM error")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LLM failed: {exc}",
            )

        return reply, (time.perf_counter() - start) * 1000

    # ────────────────────────────────────────────────────────
    # Public entry point — buffered
    # ────────────────────────────────────────────────────────

    def handle(self, req: ChatRequest, request_id: str) -> ChatResponse:
        timings: dict[str, float] = {}
        total_start = time.perf_counter()

        # 1. Cache
        cached, source, cache_ms = self._check_cache(req.message)
        timings["cache_ms"] = round(cache_ms, 2)

        if cached:
            timings["total_ms"] = round(
                (time.perf_counter() - total_start) * 1000, 2,
            )
            logger.info(
                "chat cache=%s rid=%s total=%sms",
                source, request_id, timings["total_ms"],
            )
            return ChatResponse(
                reply=cached["reply"],
                cache=source,
                request_id=request_id,
                timings_ms=timings,
            )

        # 2. Generate
        reply, llm_ms = self._generate(req.message)
        timings["llm_ms"] = round(llm_ms, 2)

        # 3. Cache
        self._store_cache(req.message, reply)

        timings["total_ms"] = round((time.perf_counter() - total_start) * 1000, 2)
        logger.info(
            "chat cache=miss rid=%s llm=%sms total=%sms",
            request_id, timings["llm_ms"], timings["total_ms"],
        )

        return ChatResponse(
            reply=reply,
            cache="miss",
            request_id=request_id,
            timings_ms=timings,
        )


# ────────────────────────────────────────────────────────────
# Request ID helper
# ────────────────────────────────────────────────────────────

def _get_request_id(request: Request) -> str:
    rid = request.headers.get("x-request-id")
    return rid or str(uuid.uuid4())[:8]


# ────────────────────────────────────────────────────────────
# Routes
# ────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    llm: LLMService = Depends(llm_dep),
) -> ChatResponse:
    request_id = _get_request_id(request)
    return GeneralChatHandler(cache, llm).handle(req, request_id)


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    llm: LLMService = Depends(llm_dep),
) -> StreamingResponse:
    """
    SSE token stream — recommended for the chat UI.

    Events:
        meta   → {request_id}
        status → "cache_hit" | "generating"
        token  → a partial text chunk (raw string)
        done   → {reply, cache, request_id, timings_ms}
        error  → {detail}
    """
    request_id = _get_request_id(request)
    handler = GeneralChatHandler(cache, llm)

    def event_stream() -> Iterator[str]:
        def emit(event: str, data: str) -> str:
            return f"event: {event}\ndata: {data}\n\n"

        total_start = time.perf_counter()

        try:
            yield emit("meta", json.dumps({"request_id": request_id}))

            # 1. Cache
            cache_start = time.perf_counter()
            cached, source = cache.get(GeneralChatHandler.NAMESPACE, req.message)
            cache_ms = (time.perf_counter() - cache_start) * 1000

            if cached:
                yield emit("status", '"cache_hit"')
                yield emit("token", json.dumps(cached["reply"]))
                yield emit("done", json.dumps({
                    "reply": cached["reply"],
                    "cache": source,
                    "request_id": request_id,
                    "timings_ms": {
                        "cache_ms": round(cache_ms, 2),
                        "total_ms": round((time.perf_counter() - total_start) * 1000, 2),
                    },
                }))
                return

            # 2. Stream from LLM
            yield emit("status", '"generating"')
            llm_start = time.perf_counter()
            full_reply: list[str] = []

            try:
                for chunk in llm.stream_chat(req.message):
                    full_reply.append(chunk)
                    yield emit("token", json.dumps(chunk))
            except LLMUnavailableError as exc:
                logger.error("Chat stream LLM unavailable: %s", exc)
                yield emit("error", json.dumps({
                    "detail": "The language model is currently unavailable.",
                }))
                return
            except Exception as exc:
                logger.exception("Chat stream failed")
                yield emit("error", json.dumps({"detail": str(exc)}))
                return

            llm_ms = (time.perf_counter() - llm_start) * 1000
            reply = "".join(full_reply).strip()

            # 3. Cache the full reply
            handler._store_cache(req.message, reply)

            yield emit("done", json.dumps({
                "reply": reply,
                "cache": "miss",
                "request_id": request_id,
                "timings_ms": {
                    "cache_ms": round(cache_ms, 2),
                    "llm_ms": round(llm_ms, 2),
                    "total_ms": round((time.perf_counter() - total_start) * 1000, 2),
                },
            }))

        except Exception as exc:
            logger.exception("Chat stream unexpected error")
            yield emit("error", json.dumps({"detail": str(exc)}))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )