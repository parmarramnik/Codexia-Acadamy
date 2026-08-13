"""
Quiz & Certificate Microservice entrypoint.
Port: 8003
Routes: /api/quizzes, /api/certificates, /api/v3/certificates
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from config import settings
from database import create_tables
from middleware.cors import setup_cors
from middleware.rate_limiter import setup_rate_limiter
from middleware.error_handler import setup_error_handlers
from utils.helpers import ensure_directory
from routes import quizzes, certificates, v3_certificates

SERVICE_PORT = 8003
SERVICE_NAME = "Quiz & Certificate Microservice"


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

    # Static uploads for certificates
    static_dir = os.path.join(backend_dir, settings.UPLOAD_DIR)
    ensure_directory(os.path.join(static_dir, "certificates"))
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    prefix = settings.API_PREFIX
    app.include_router(quizzes.router, prefix=f"{prefix}/quizzes", tags=["Quizzes"])
    app.include_router(certificates.router, prefix=f"{prefix}/certificates", tags=["Certificates"])
    app.include_router(v3_certificates.router, prefix=prefix)

    @app.on_event("startup")
    def on_startup():
        create_tables()

    @app.get("/", tags=["Root"])
    def root():
        return RedirectResponse(url="/api/docs")

    @app.get("/health", tags=["Health"])
    @app.get("/api/quizzes/health", tags=["Health"])
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
