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
        "http://localhost:8000"
    ]
    for o in extra_origins:
        if o not in origins:
            origins.append(o)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
