"""
CORS middleware configuration.
Allows requests from the configured frontend origins.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


EXTRA_ORIGINS = [
    "https://codexia-acadamy.vercel.app",
    "https://codexia-academy.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]


def allowed_origins() -> list[str]:
    origins = settings.cors_origins_list
    for o in EXTRA_ORIGINS:
        if o not in origins:
            origins.append(o)
    return origins


def trusted_origin(origin: str) -> bool:
    """Exact match against explicitly configured origins (no wildcard preview domains)."""
    origin = (origin or "").rstrip("/")
    return any(origin == o.rstrip("/") for o in allowed_origins() + [settings.FRONTEND_URL])


def setup_cors(app: FastAPI) -> None:
    """Add CORS middleware to the FastAPI application."""
    origins = allowed_origins()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
