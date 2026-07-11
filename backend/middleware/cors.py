"""
CORS middleware configuration.
Allows requests from the configured frontend origins.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


def setup_cors(app: FastAPI) -> None:
    """Add CORS middleware to the FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
