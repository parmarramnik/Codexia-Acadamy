"""
Factory shared by every microservice: identical middleware, error handling, health endpoints.

A service module only declares which routers it owns:

    app = create_service_app("Course Service", 8002, [(courses.router, "/courses"), ...])
"""
import logging
from typing import Callable, Optional, Sequence

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import text

from config import settings, validate_production_settings
from database import engine
from middleware.cors import setup_cors
from middleware.error_handler import setup_error_handlers
from middleware.rate_limiter import setup_rate_limiter
from middleware.request_context import RequestContextMiddleware
from utils.cache import cache_status

logger = logging.getLogger("codexia.service")


def create_service_app(
    name: str,
    port: int,
    routers: Sequence[tuple[APIRouter, str]],
    *,
    extra_checks: Optional[Callable[[], dict]] = None,
    on_startup: Optional[Callable[[], None]] = None,
) -> FastAPI:
    """`routers` is a list of (router, prefix-after-/api); use "" for routers that carry their own prefix."""
    app = FastAPI(
        title=f"{settings.APP_NAME} - {name}",
        version=settings.APP_VERSION,
        docs_url="/api/docs" if settings.DEBUG else None,   # internal services: no public docs in production
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
    )
    setup_cors(app)
    setup_rate_limiter(app)
    setup_error_handlers(app)
    app.add_middleware(RequestContextMiddleware, service=name)

    for router, prefix in routers:
        app.include_router(router, prefix=f"{settings.API_PREFIX}{prefix}")

    @app.on_event("startup")
    def _startup():
        validate_production_settings()
        logger.info("%s starting on port %s (debug=%s)", name, port, settings.DEBUG)
        if on_startup:
            on_startup()

    @app.get("/", include_in_schema=False)
    def _root():
        return RedirectResponse(url="/api/docs") if settings.DEBUG else JSONResponse({"service": name})

    @app.get("/health", tags=["Health"])
    def health():
        """Liveness: the process is serving requests."""
        return {"status": "healthy", "service": name, "port": port, "version": settings.APP_VERSION}

    @app.get("/health/ready", tags=["Health"])
    def ready():
        """Readiness: dependencies this service needs are reachable. 503 when a required one is down."""
        components = {}
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            components["database"] = {"status": "healthy"}
        except Exception as exc:  # noqa: BLE001
            components["database"] = {"status": "unhealthy", "detail": type(exc).__name__}
        components["cache"] = cache_status()
        if extra_checks:
            components.update(extra_checks())
        failed = [n for n, c in components.items() if c.get("status") == "unhealthy"]
        return JSONResponse(status_code=503 if failed else 200,
                            content={"status": "unhealthy" if failed else "ready", "service": name,
                                     "failed": failed, "components": components})

    return app
