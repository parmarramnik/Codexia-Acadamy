"""
Course & Content Microservice entrypoint.
Port: 8002
Routes: /api/courses, /api/lectures, /api/course-builder, /api/notes, /api/flashcards, /api/study-planner
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
from routes import courses, lectures, course_builder, notes, flashcards, study_planner

SERVICE_PORT = 8002
SERVICE_NAME = "Course & Content Microservice"


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

    # Static uploads for course assets
    static_dir = os.path.join(backend_dir, settings.UPLOAD_DIR)
    ensure_directory(static_dir)
    ensure_directory(os.path.join(static_dir, "videos"))
    ensure_directory(os.path.join(static_dir, "thumbnails"))
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    prefix = settings.API_PREFIX
    app.include_router(courses.router, prefix=f"{prefix}/courses", tags=["Courses"])
    app.include_router(lectures.router, prefix=f"{prefix}/lectures", tags=["Lectures"])
    app.include_router(course_builder.router, prefix=f"{prefix}/course-builder", tags=["Course Builder"])
    app.include_router(notes.router, prefix=f"{prefix}/notes", tags=["Notes"])
    app.include_router(flashcards.router, prefix=f"{prefix}/flashcards", tags=["Flashcards"])
    app.include_router(study_planner.router, prefix=f"{prefix}/study-planner", tags=["Study Planner"])

    @app.on_event("startup")
    def on_startup():
        create_tables()

    @app.get("/", tags=["Root"])
    def root():
        return RedirectResponse(url="/api/docs")

    @app.get("/health", tags=["Health"])
    @app.get("/api/courses/health", tags=["Health"])
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
