"""
Analytics & Admin Microservice entrypoint.
Port: 8006
Routes: /api/analytics, /api/admin, /api/logs, v3_analytics, v3_search, v3_comms, v4_admin
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
from routes import analytics, v3_analytics, admin, v4_admin, logs, v3_search, v3_comms

SERVICE_PORT = 8006
SERVICE_NAME = "Analytics & Admin Microservice"


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
    app.include_router(analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"])
    app.include_router(v3_analytics.router, prefix=prefix)
    app.include_router(admin.router, prefix=f"{prefix}/admin", tags=["Admin"])
    app.include_router(v4_admin.router, prefix=prefix)
    app.include_router(logs.router, prefix=f"{prefix}/logs", tags=["Logs"])
    app.include_router(v3_search.router, prefix=prefix)
    app.include_router(v3_comms.router, prefix=prefix)

    @app.on_event("startup")
    def on_startup():
        create_tables()
        # Non-blocking background initialization and synchronization of Elasticsearch
        import threading
        def init_es_background():
            import time
            from database import SessionLocal
            from utils.elasticsearch_client import init_indices, is_es_available
            from services.search_service import sync_all_to_elasticsearch
            for _ in range(15):
                if is_es_available():
                    init_indices()
                    db = SessionLocal()
                    try:
                        sync_all_to_elasticsearch(db)
                    finally:
                        db.close()
                    break
                time.sleep(2)

        threading.Thread(target=init_es_background, daemon=True).start()


    @app.get("/", tags=["Root"])
    def root():
        return RedirectResponse(url="/api/docs")

    @app.get("/health", tags=["Health"])
    @app.get("/api/analytics/health", tags=["Health"])
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
