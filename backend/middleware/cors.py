"""
CORS middleware configuration.
Allows requests from the configured frontend origins.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


def setup_cors(app: FastAPI) -> None:
    """Add CORS middleware to the FastAPI application."""
    origins = settings.cors_origins_list
    extra_origins = [
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
    for o in extra_origins:
        if o not in origins:
            origins.append(o)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
