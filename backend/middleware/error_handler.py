"""
Global error handler middleware.
Catches unhandled exceptions and returns consistent JSON error responses.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging
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

    from services.code_runner import CodeExecutionUnavailable, RunBusy

    @app.exception_handler(CodeExecutionUnavailable)
    async def code_execution_unavailable_handler(request: Request, exc: CodeExecutionUnavailable):
        return JSONResponse(status_code=503, content={"detail": str(exc), "type": "code_execution_unavailable"},
                            headers={"Retry-After": "10"})

    @app.exception_handler(RunBusy)
    async def run_busy_handler(request: Request, exc: RunBusy):
        return JSONResponse(status_code=429, content={"detail": str(exc), "type": "run_busy"},
                            headers={"Retry-After": "3"})

    from ai.llm import LLMError
    from ai.rag.access import RagAccessDenied
    from ai.rag.errors import RagUnavailable

    @app.exception_handler(LLMError)
    async def llm_error_handler(request: Request, exc: LLMError):
        return JSONResponse(status_code=exc.status_code, content={"detail": str(exc), "type": f"ai_{exc.kind}"})

    @app.exception_handler(RagAccessDenied)
    async def rag_access_handler(request: Request, exc: RagAccessDenied):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "type": "rag_access", "code": exc.code})

    @app.exception_handler(RagUnavailable)
    async def rag_unavailable_handler(request: Request, exc: RagUnavailable):
        logging.getLogger("codexia.rag").error("RAG unavailable: %s", exc)
        return JSONResponse(status_code=503, content={"detail": "Course search is temporarily unavailable.",
                                                       "type": "rag_unavailable"})

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
