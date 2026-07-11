"""
FastAPI application entry point.
Registers all middleware, routes, and startup events.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

from config import settings
from database import create_tables
from middleware.cors import setup_cors
from middleware.rate_limiter import setup_rate_limiter
from middleware.error_handler import setup_error_handlers
from utils.helpers import ensure_directory


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI app."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
    )

    # Middleware
    setup_cors(app)
    setup_rate_limiter(app)
    setup_error_handlers(app)

    # Static file serving
    static_dir = os.path.join(os.path.dirname(__file__), settings.UPLOAD_DIR)
    ensure_directory(static_dir)
    ensure_directory(os.path.join(static_dir, "videos"))
    ensure_directory(os.path.join(static_dir, "thumbnails"))
    ensure_directory(os.path.join(static_dir, "certificates"))
    ensure_directory(os.path.join(static_dir, "avatars"))
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Register routes
    register_routes(app)

    # Startup event
    @app.on_event("startup")
    def on_startup():
        create_tables()

    # Root redirect to API Docs
    from fastapi.responses import RedirectResponse
    @app.get("/", tags=["Root"])
    def root_redirect():
        """Redirect the root request directly to the Swagger API documentation."""
        return RedirectResponse(url="/api/docs")

    # Health check
    @app.get("/api/health", tags=["Health"])
    def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    return app


def register_routes(app: FastAPI) -> None:
    """Register all API route modules."""
    from routes import auth, users, courses, lectures, quizzes, coding, notes, flashcards, certificates, analytics, admin, ai, logs

    prefix = settings.API_PREFIX

    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Authentication"])
    app.include_router(users.router, prefix=f"{prefix}/users", tags=["Users"])
    app.include_router(courses.router, prefix=f"{prefix}/courses", tags=["Courses"])
    app.include_router(lectures.router, prefix=f"{prefix}/lectures", tags=["Lectures"])
    app.include_router(quizzes.router, prefix=f"{prefix}/quizzes", tags=["Quizzes"])
    app.include_router(coding.router, prefix=f"{prefix}/coding", tags=["Coding Practice"])
    app.include_router(notes.router, prefix=f"{prefix}/notes", tags=["Notes"])
    app.include_router(flashcards.router, prefix=f"{prefix}/flashcards", tags=["Flashcards"])
    app.include_router(certificates.router, prefix=f"{prefix}/certificates", tags=["Certificates"])
    app.include_router(analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"])
    app.include_router(admin.router, prefix=f"{prefix}/admin", tags=["Admin"])
    app.include_router(ai.router, prefix=f"{prefix}/ai", tags=["AI"])
    app.include_router(logs.router, prefix=f"{prefix}/logs", tags=["Logs"])


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
