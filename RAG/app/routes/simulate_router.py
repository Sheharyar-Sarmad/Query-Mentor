"""
Simulate router — LLM-driven SQL execution preview.

Exposes:
    POST /api/v1/simulate           → JSON response
    POST /api/v1/simulate/stream    → SSE stream

Production features:
    - Request IDs for tracing
    - Per-stage timing (cache / LLM)
    - Structured error taxonomy
    - Exact-match cache only (SQL semantics are meaning-sensitive)
    - Schema-versioned cache (bumping schema invalidates stored results)
    - Normalizes LLM output — success shape vs error shape are distinct
    - Streaming variant for real-time UX
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

router = APIRouter(prefix="/simulate", tags=["Simulate"])

# Canonical schema
CANONICAL_SCHEMA = """
users(user_id SERIAL PK, email VARCHAR(255) UNIQUE, full_name VARCHAR(100),
      created_at TIMESTAMP, country VARCHAR(2), is_active BOOLEAN)
products(product_id SERIAL PK, name VARCHAR(200), category VARCHAR(50),
         price DECIMAL(10,2), stock INTEGER, created_at TIMESTAMP)
orders(order_id SERIAL PK, user_id INTEGER FK→users, order_date DATE,
       status VARCHAR(20), total_amount DECIMAL(10,2))
order_items(item_id SERIAL PK, order_id INTEGER FK→orders,
            product_id INTEGER FK→products, quantity INTEGER, unit_price DECIMAL(10,2))
employees(employee_id SERIAL PK, full_name VARCHAR(100),
          manager_id INTEGER FK→employees, department VARCHAR(50),
          salary DECIMAL(10,2), hire_date DATE)
departments(department_id SERIAL PK, name VARCHAR(100), budget DECIMAL(12,2))
"""

# Bump this whenever the canonical schema above changes. It participates in
# the cache key so old simulated results are not served against a new schema.
SCHEMA_VERSION = "v1"


# Schemas
class SimulateRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=5000)
    dialect: str = Field(default="postgres", pattern="^(postgres|mysql|sqlite)$")


class SimulateResponse(BaseModel):
    status: str
    simulated: bool = True

    # Success fields
    columns: list[str] | None = None
    rows: list[dict] | None = None
    row_count_estimate: int | None = None
    explanation: str | None = None

    # Error fields
    error_message: str | None = None
    why_it_failed: str | None = None
    suggested_fix: str | None = None

    # Metadata
    dialect: str
    cache: str
    request_id: str
    timings_ms: dict[str, float]


# Response normalization
class SimulationNormalizer:
    """Normalizes the raw LLM simulation output into a strict shape."""

    SUCCESS_KEYS = ("columns", "rows", "row_count_estimate", "explanation")
    ERROR_KEYS = ("error_message", "why_it_failed", "suggested_fix")

    @classmethod
    def normalize(cls, raw: dict) -> dict:
        """
        Guarantee:
          - status is SUCCESS or ERROR
          - SUCCESS responses have rows + columns, no error fields
          - ERROR responses have error_message, no rows/columns
          - If the LLM returns a malformed mix, prefer the richer side
        """
        if not isinstance(raw, dict):
            raw = {}

        status = str(raw.get("status", "")).upper()
        has_success = cls._has_success(raw)
        has_error = cls._has_error(raw)

        # Status inference when the LLM omits it
        if status not in ("SUCCESS", "ERROR"):
            status = "SUCCESS" if has_success and not has_error else "ERROR"

        if status == "SUCCESS" and not has_success:
            # LLM claimed success but provided nothing to show — treat as error
            status = "ERROR"

        normalized: dict = {"status": status}

        if status == "SUCCESS":
            columns = raw.get("columns") or []
            rows = raw.get("rows") or []

            # Sanitize row keys against columns when columns is present
            if columns and rows:
                allowed = set(columns)
                rows = [
                    {k: v for k, v in r.items() if k in allowed}
                    if isinstance(r, dict) else {"value": r}
                    for r in rows
                ]

            normalized["columns"] = list(columns)
            normalized["rows"] = rows
            normalized["row_count_estimate"] = int(
                raw.get("row_count_estimate") or len(rows)
            )
            normalized["explanation"] = str(raw.get("explanation") or "")
        else:
            normalized["error_message"] = str(
                raw.get("error_message") or "Unknown execution error."
            )
            normalized["why_it_failed"] = str(raw.get("why_it_failed") or "")
            normalized["suggested_fix"] = str(raw.get("suggested_fix") or "")

        return normalized

    @classmethod
    def _has_success(cls, raw: dict) -> bool:
        return any(
            raw.get(k) not in (None, "", [], {})
            for k in cls.SUCCESS_KEYS
        )

    @classmethod
    def _has_error(cls, raw: dict) -> bool:
        return any(
            raw.get(k) not in (None, "", [], {})
            for k in cls.ERROR_KEYS
        )

# Handler
class SimulateHandler:
    """Encapsulates the /simulate business flow."""

    NAMESPACE = "simulate"

    def __init__(self, cache: CacheManager, llm: LLMService) -> None:
        self._cache = cache
        self._llm = llm

    # Cache
    def _cache_extras(self, dialect: str) -> dict:
        # Schema version participates in the cache key so the results are
        # invalidated when the canonical schema changes.
        return {"dialect": dialect, "schema": SCHEMA_VERSION}

    def _check_cache(
        self,
        sql: str,
        dialect: str,
    ) -> tuple[dict | None, str, float]:
        start = time.perf_counter()
        cached, source = self._cache.get_exact(
            self.NAMESPACE, sql, self._cache_extras(dialect)
        )
        return cached, source, (time.perf_counter() - start) * 1000

    # LLM
    def _simulate(self, sql: str, dialect: str) -> tuple[dict, float]:
        start = time.perf_counter()

        try:
            raw = self._llm.simulate_sql(sql, CANONICAL_SCHEMA, dialect)
        except LLMTimeoutError as exc:
            logger.warning("Simulate timeout: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="The model took too long to simulate the query.",
            )
        except LLMUnavailableError as exc:
            logger.error("Simulate LLM unavailable: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The language model is currently unavailable.",
            )
        except LLMResponseError as exc:
            logger.warning("Simulate malformed response: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The model returned an invalid simulation.",
            )
        except LLMError as exc:
            logger.exception("Simulate LLM error")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Simulation failed: {exc}",
            )

        normalized = SimulationNormalizer.normalize(raw)
        return normalized, (time.perf_counter() - start) * 1000

    # Public entry point

    def handle(
        self,
        req: SimulateRequest,
        request_id: str,
    ) -> SimulateResponse:
        timings: dict[str, float] = {}
        total_start = time.perf_counter()

        # 1. Cache
        cached, source, cache_ms = self._check_cache(req.sql, req.dialect)
        timings["cache_ms"] = round(cache_ms, 2)

        if cached:
            timings["total_ms"] = round(
                (time.perf_counter() - total_start) * 1000, 2,
            )
            logger.info(
                "simulate cache=%s rid=%s total=%sms",
                source, request_id, timings["total_ms"],
            )
            return SimulateResponse(
                **cached,
                dialect=req.dialect,
                cache=source,
                request_id=request_id,
                timings_ms=timings,
            )

        # 2. Simulate via LLM
        normalized, llm_ms = self._simulate(req.sql, req.dialect)
        timings["llm_ms"] = round(llm_ms, 2)

        # 3. Cache
        try:
            self._cache.set_exact(
                self.NAMESPACE,
                req.sql,
                normalized,
                self._cache_extras(req.dialect),
            )
        except Exception as exc:
            logger.warning("Cache write failed: %s", exc)

        timings["total_ms"] = round((time.perf_counter() - total_start) * 1000, 2)
        logger.info(
            "simulate status=%s rid=%s llm=%sms total=%sms",
            normalized.get("status"),
            request_id,
            timings["llm_ms"],
            timings["total_ms"],
        )

        return SimulateResponse(
            **normalized,
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
@router.post("", response_model=SimulateResponse)
async def simulate(
    req: SimulateRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    llm: LLMService = Depends(llm_dep),
) -> SimulateResponse:
    request_id = _get_request_id(request)
    handler = SimulateHandler(cache, llm)
    return handler.handle(req, request_id)


@router.post("/stream")
async def simulate_stream(
    req: SimulateRequest,
    request: Request,
    cache: CacheManager = Depends(cache_dep),
    llm: LLMService = Depends(llm_dep),
) -> StreamingResponse:
    """
    SSE variant.

    Events:
        meta   → {request_id, dialect}
        status → "cache_hit" | "simulating"
        done   → full SimulateResponse payload
        error  → {detail}
    """
    request_id = _get_request_id(request)
    handler = SimulateHandler(cache, llm)

    def event_stream() -> Iterator[str]:
        def emit(event: str, data: str) -> str:
            return f"event: {event}\ndata: {data}\n\n"

        try:
            yield emit("meta", json.dumps({
                "request_id": request_id,
                "dialect": req.dialect,
            }))

            cached, source = cache.get_exact(
                SimulateHandler.NAMESPACE,
                req.sql,
                handler._cache_extras(req.dialect),
            )

            if cached:
                yield emit("status", '"cache_hit"')
                yield emit("done", json.dumps({
                    **cached,
                    "dialect": req.dialect,
                    "cache": source,
                    "request_id": request_id,
                }))
                return

            yield emit("status", '"simulating"')
            normalized, _ = handler._simulate(req.sql, req.dialect)

            try:
                cache.set_exact(
                    SimulateHandler.NAMESPACE,
                    req.sql,
                    normalized,
                    handler._cache_extras(req.dialect),
                )
            except Exception as exc:
                logger.warning("Cache write failed in stream: %s", exc)

            yield emit("done", json.dumps({
                **normalized,
                "dialect": req.dialect,
                "cache": "miss",
                "request_id": request_id,
            }))

        except HTTPException as exc:
            yield emit("error", json.dumps({"detail": exc.detail}))
        except Exception as exc:
            logger.exception("Simulate stream failed")
            yield emit("error", json.dumps({"detail": str(exc)}))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )