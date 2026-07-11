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

limiter = Limiter(key_func=get_remote_address)


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
