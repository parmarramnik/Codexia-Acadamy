"""
Global error handler middleware.
Catches unhandled exceptions and returns consistent JSON error responses.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import traceback

from config import settings


def setup_error_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(SQLAlchemyError)
    async def database_error_handler(request: Request, exc: SQLAlchemyError):
        detail = "A database error occurred."
        if settings.DEBUG:
            detail = str(exc)
        return JSONResponse(
            status_code=500,
            content={"detail": detail, "type": "database_error"},
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc), "type": "validation_error"},
        )

    @app.exception_handler(Exception)
    async def general_error_handler(request: Request, exc: Exception):
        detail = "An internal server error occurred."
        if settings.DEBUG:
            detail = str(exc)
            traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": detail, "type": "internal_error"},
        )
