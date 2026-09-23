"""
QueryMentor — FastAPI application.

The Server class wires everything:
    - Lifespan with warm-up + timing
    - CORS (env-aware)
    - Rate limit middleware
    - Request ID middleware (X-Request-Id in/out)
    - Access log middleware (method, path, status, duration)
    - Global exception handlers (consistent JSON errors)
    - 4 API routers
    - System + admin endpoints with real dependency health checks

`app` is the ASGI target.
"""

import logging
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config.settings import Settings, settings as global_settings
from app.routes import (
    general_chat_router,
    simulate_router,
    sql_to_text_router,
    text_to_sql_router,
)


# ────────────────────────────────────────────────────────────
# Logging
# ────────────────────────────────────────────────────────────

def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


logger = logging.getLogger("querymentor")


# ────────────────────────────────────────────────────────────
# Middleware
# ────────────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory per-IP rate limiter. Good enough for a single instance."""

    SKIP_PREFIXES = ("/docs", "/redoc", "/openapi.json", "/health")

    def __init__(self, app, max_requests: int = 30, window_seconds: int = 60):
        super().__init__(app)
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if path.startswith(self.SKIP_PREFIXES):
            return await call_next(request)

        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "unknown")
        )

        now = time.time()
        window_start = now - self._window
        self._hits[client_ip] = [t for t in self._hits[client_ip] if t > window_start]

        if len(self._hits[client_ip]) >= self._max:
            logger.warning("Rate limit hit ip=%s path=%s", client_ip, path)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": (
                        f"Rate limit exceeded. Max {self._max} requests "
                        f"per {self._window}s per IP."
                    )
                },
            )

        self._hits[client_ip].append(now)
        return await call_next(request)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Attaches a request ID and an access log entry to every request.

    - Reads X-Request-Id from the incoming request (if provided)
    - Generates one otherwise
    - Echoes it back on the response
    - Logs method, path, status, and duration
    """

    async def dispatch(self, request: Request, call_next):
        # Accept or generate request id
        rid = request.headers.get("x-request-id") or str(uuid.uuid4())[:8]
        request.state.request_id = rid

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "Unhandled error rid=%s method=%s path=%s duration=%.1fms",
                rid, request.method, request.url.path, duration_ms,
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-Id"] = rid

        # Skip noisy access logs for docs / health
        path = request.url.path
        if not path.startswith(("/docs", "/redoc", "/openapi.json")):
            logger.info(
                "%s %s %s rid=%s %.1fms",
                request.method, path, response.status_code, rid, duration_ms,
            )

        return response


# ────────────────────────────────────────────────────────────
# Server
# ────────────────────────────────────────────────────────────

class Server:
    """Builds and configures the FastAPI application."""

    def __init__(self, config: Settings | None = None) -> None:
        _configure_logging()
        self._settings = config or global_settings

        self.app: FastAPI = self._create_app()
        self._add_middleware()
        self._include_routers()
        self._add_system_routes()
        self._add_admin_routes()
        self._add_exception_handlers()

    # ────────────────────────────────────────────────────────
    # App creation
    # ────────────────────────────────────────────────────────

    def _create_app(self) -> FastAPI:
        return FastAPI(
            title=self._settings.APP_NAME,
            description=self._settings.APP_DESCRIPTION,
            version=self._settings.APP_VERSION,
            contact={
                "name": self._settings.AUTHOR_NAME,
                "email": self._settings.AUTHOR_EMAIL,
            },
            docs_url=None if self._settings.is_production else "/docs",
            redoc_url=None if self._settings.is_production else "/redoc",
            openapi_url=None if self._settings.is_production else "/openapi.json",
            lifespan=self._lifespan,
        )

    # ────────────────────────────────────────────────────────
    # Lifespan
    # ────────────────────────────────────────────────────────

    @asynccontextmanager
    async def _lifespan(self, app: FastAPI):
        logger.info(
            "%s v%s starting (phase=%s, prefix=%s)",
            self._settings.APP_NAME,
            self._settings.APP_VERSION,
            self._settings.APP_PHASE,
            self._settings.APP_BASE_ROUTE_PREFIX,
        )

        warmup_start = time.perf_counter()
        try:
            from app.services.retriever import get_retriever_service
            get_retriever_service().warm_up()
            elapsed = (time.perf_counter() - warmup_start) * 1000
            logger.info("Retriever warmed up in %.0f ms", elapsed)
        except Exception as exc:
            logger.warning("Retriever warm-up failed: %s", exc)

        yield

        logger.info("%s stopped", self._settings.APP_NAME)

    # ────────────────────────────────────────────────────────
    # Middleware
    # ────────────────────────────────────────────────────────

    def _add_middleware(self) -> None:
        origins = (
            ["*"]
            if self._settings.is_development
            else [
                "https://querymentor.vercel.app",
                "https://querymentor.app",
            ]
        )

        # Order matters — last added runs first on request.
        # CORS first (outermost), then rate limit, then request context.
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-Request-Id"],
        )
        self.app.add_middleware(
            RateLimitMiddleware,
            max_requests=self._settings.RATE_LIMIT_MAX,
            window_seconds=self._settings.RATE_LIMIT_WINDOW,
        )
        self.app.add_middleware(RequestContextMiddleware)

    # ────────────────────────────────────────────────────────
    # Routers
    # ────────────────────────────────────────────────────────

    def _include_routers(self) -> None:
        prefix = self._settings.APP_BASE_ROUTE_PREFIX
        self.app.include_router(text_to_sql_router, prefix=prefix)
        self.app.include_router(sql_to_text_router, prefix=prefix)
        self.app.include_router(simulate_router, prefix=prefix)
        self.app.include_router(general_chat_router, prefix=prefix)

    # ────────────────────────────────────────────────────────
    # System routes
    # ────────────────────────────────────────────────────────

    def _add_system_routes(self) -> None:
        @self.app.get("/", tags=["System"])
        async def root() -> dict:
            return {
                "service": self._settings.APP_NAME,
                "version": self._settings.APP_VERSION,
                "phase": self._settings.APP_PHASE,
                "api": self._settings.APP_BASE_ROUTE_PREFIX,
                "docs": "/docs" if not self._settings.is_production else None,
            }

        @self.app.get("/health", tags=["System"])
        async def health() -> JSONResponse:
            """
            Deep health check — verifies each service.

            Returns 200 if all services are reachable, 503 otherwise.
            """
            checks: dict[str, dict] = {}
            overall_ok = True

            # Cache
            try:
                from app.services.cache import get_cache_manager
                stats = get_cache_manager().stats()
                checks["cache"] = {
                    "status": "ok",
                    "l1_size": stats["l1_size"],
                    "l2_entries": stats["l2_entries"],
                    "l3_entries": stats["l3_entries"],
                }
            except Exception as exc:
                overall_ok = False
                checks["cache"] = {"status": "error", "detail": str(exc)}

            # Retriever / Pinecone
            try:
                from app.services.retriever import get_retriever_service
                r = get_retriever_service().health()
                checks["retriever"] = {
                    "status": "ok" if r.get("index_ready") else "error",
                    "vector_count": r.get("vector_count"),
                    "namespace_count": r.get("namespace_count"),
                }
                if not r.get("index_ready"):
                    overall_ok = False
            except Exception as exc:
                overall_ok = False
                checks["retriever"] = {"status": "error", "detail": str(exc)}

            # LLM (cheap check — no API call)
            try:
                from app.services.llm import get_llm_service
                usage = get_llm_service().usage.snapshot()
                checks["llm"] = {
                    "status": "ok",
                    "model": self._settings.LLM_MODEL,
                    "calls": usage["calls"],
                    "errors": usage["errors"],
                }
            except Exception as exc:
                overall_ok = False
                checks["llm"] = {"status": "error", "detail": str(exc)}

            payload = {
                "status": "ok" if overall_ok else "degraded",
                "service": self._settings.APP_NAME,
                "version": self._settings.APP_VERSION,
                "phase": self._settings.APP_PHASE,
                "checks": checks,
            }

            return JSONResponse(
                status_code=200 if overall_ok else 503,
                content=payload,
            )

    # ────────────────────────────────────────────────────────
    # Admin routes
    # ────────────────────────────────────────────────────────

    def _add_admin_routes(self) -> None:
        prefix = self._settings.APP_BASE_ROUTE_PREFIX

        @self.app.get(f"{prefix}/admin/cache/stats", tags=["Admin"])
        async def cache_stats() -> dict:
            from app.services.cache import get_cache_manager
            return get_cache_manager().stats()

        @self.app.post(f"{prefix}/admin/cache/clear", tags=["Admin"])
        async def cache_clear() -> dict:
            from app.services.cache import get_cache_manager
            get_cache_manager().clear()
            logger.info("Cache cleared by admin")
            return {"ok": True}

        @self.app.get(f"{prefix}/admin/llm/stats", tags=["Admin"])
        async def llm_stats() -> dict:
            from app.services.llm import get_llm_service
            return get_llm_service().usage.snapshot()

        @self.app.get(f"{prefix}/admin/retriever/health", tags=["Admin"])
        async def retriever_health() -> dict:
            from app.services.retriever import get_retriever_service
            return get_retriever_service().health()

        @self.app.post(f"{prefix}/admin/ingest", tags=["Admin"])
        async def trigger_ingestion(force: bool = False) -> dict:
            """Re-ingest the SQL reference PDF. Useful after updating the PDF."""
            from pathlib import Path
            from app.services.ingestion import IngestionService

            data_dir = Path(__file__).resolve().parent / "data"
            pdf_path = data_dir / "sql_reference.pdf"

            stats = IngestionService().run(pdf_path=pdf_path, force=force)
            return stats.to_dict()

    # ────────────────────────────────────────────────────────
    # Exception handlers
    # ────────────────────────────────────────────────────────

    def _add_exception_handlers(self) -> None:
        @self.app.exception_handler(RequestValidationError)
        async def validation_error_handler(
            request: Request,
            exc: RequestValidationError,
        ) -> JSONResponse:
            rid = getattr(request.state, "request_id", None)
            logger.info(
                "Validation error rid=%s path=%s errors=%s",
                rid, request.url.path, exc.errors(),
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "detail": exc.errors(),
                    "request_id": rid,
                },
            )

        @self.app.exception_handler(HTTPException)
        async def http_exception_handler(
            request: Request,
            exc: HTTPException,
        ) -> JSONResponse:
            rid = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "detail": exc.detail,
                    "request_id": rid,
                },
                headers=getattr(exc, "headers", None),
            )

        @self.app.exception_handler(Exception)
        async def unhandled_exception_handler(
            request: Request,
            exc: Exception,
        ) -> JSONResponse:
            rid = getattr(request.state, "request_id", None)
            logger.exception(
                "Unhandled exception rid=%s path=%s",
                rid, request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Internal server error.",
                    "request_id": rid,
                },
            )


# ────────────────────────────────────────────────────────────
# ASGI target
# ────────────────────────────────────────────────────────────

server = Server()
app = server.app