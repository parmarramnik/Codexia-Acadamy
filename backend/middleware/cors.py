"""
CORS middleware configuration.

Production allows exactly the origins in CORS_ORIGINS plus FRONTEND_URL: no wildcard hosting domains
(any *.vercel.app site could otherwise call the API from a visitor's browser) and no localhost.
With DEBUG=true, local development origins are allowed as well.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

DEV_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?"
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
ALLOWED_HEADERS = ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID", "Range", "Accept"]


def allowed_origins() -> list[str]:
    origins = [o.strip().rstrip("/") for o in settings.cors_origins_list if o.strip()]
    frontend = (settings.FRONTEND_URL or "").strip().rstrip("/")
    if frontend and frontend not in origins:
        origins.append(frontend)
    return origins


def trusted_origin(origin: str) -> bool:
    """Exact match against explicitly configured origins (no wildcard preview domains)."""
    return (origin or "").rstrip("/") in allowed_origins()


def setup_cors(app: FastAPI) -> None:
    """Add CORS middleware to the FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_origin_regex=DEV_ORIGIN_REGEX if settings.DEBUG else None,
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
        expose_headers=["Content-Range", "Accept-Ranges", "X-Request-ID"],
    )
