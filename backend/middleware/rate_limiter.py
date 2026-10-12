"""
Rate limiting middleware using slowapi.
Prevents abuse of auth and general API endpoints.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from config import settings

_storage_options = (
    {"socket_timeout": settings.REDIS_SOCKET_TIMEOUT, "socket_connect_timeout": settings.REDIS_SOCKET_TIMEOUT,
     "max_connections": settings.REDIS_MAX_CONNECTIONS}
    if settings.RATE_LIMIT_STORAGE_URI.startswith(("redis://", "rediss://")) else {}
)

# If Redis is unreachable at runtime the limiter degrades to per-process counters instead of failing requests.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    storage_options=_storage_options,
    in_memory_fallback_enabled=True,
)


def setup_rate_limiter(app: FastAPI) -> None:
    """Add rate limiting middleware to the FastAPI application."""
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests. Please slow down.",
                "retry_after": str(exc.detail),
            },
        )
