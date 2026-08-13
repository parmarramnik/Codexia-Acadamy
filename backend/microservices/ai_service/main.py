"""
AI Microservice entrypoint.
Port: 8005
Routes: /api/ai, v3_ai
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from config import settings
from database import create_tables
from middleware.cors import setup_cors
from middleware.rate_limiter import setup_rate_limiter
from middleware.error_handler import setup_error_handlers
from routes import ai, v3_ai

SERVICE_PORT = 8005
SERVICE_NAME = "AI Microservice"


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.APP_NAME} - {SERVICE_NAME}",
        version=settings.APP_VERSION,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    setup_cors(app)
    setup_rate_limiter(app)
    setup_error_handlers(app)

    prefix = settings.API_PREFIX
    app.include_router(ai.router, prefix=f"{prefix}/ai", tags=["AI"])
    app.include_router(v3_ai.router, prefix=prefix)

    @app.on_event("startup")
    def on_startup():
        create_tables()

    @app.get("/", tags=["Root"])
    def root():
        return RedirectResponse(url="/api/docs")

    @app.get("/health", tags=["Health"])
    @app.get("/api/ai/health", tags=["Health"])
    def health_check():
        return {
            "status": "healthy",
            "service": SERVICE_NAME,
            "port": SERVICE_PORT,
            "version": settings.APP_VERSION,
        }

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT, reload=settings.DEBUG)
