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
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # Middleware
    setup_cors(app)
    setup_rate_limiter(app)
    setup_error_handlers(app)
    from middleware.security_headers import SecurityHeadersMiddleware
    from fastapi.middleware.gzip import GZipMiddleware
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=500)

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

    # Explicit OpenAPI spec endpoint
    from fastapi.responses import JSONResponse
    @app.get("/api/openapi.json", include_in_schema=False)
    def get_openapi_spec():
        return JSONResponse(content=app.openapi())

    return app


def register_routes(app: FastAPI) -> None:
    """Register all API route modules."""
    from routes import auth, users, courses, lectures, quizzes, coding, notes, flashcards, certificates, analytics, admin, ai, logs, course_builder, study_planner, git
    from routes import v3_search, v3_comms, v3_certificates, v3_ai, v3_analytics, v3_coding

    prefix = settings.API_PREFIX

    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Authentication"])
    app.include_router(users.router, prefix=f"{prefix}/users", tags=["Users"])
    app.include_router(courses.router, prefix=f"{prefix}/courses", tags=["Courses"])
    app.include_router(lectures.router, prefix=f"{prefix}/lectures", tags=["Lectures"])
    app.include_router(quizzes.router, prefix=f"{prefix}/quizzes", tags=["Quizzes"])
    app.include_router(v3_coding.router, prefix=prefix)
    app.include_router(coding.router, prefix=f"{prefix}/coding", tags=["Coding Practice"])
    app.include_router(notes.router, prefix=f"{prefix}/notes", tags=["Notes"])
    app.include_router(git.router, prefix=f"{prefix}/git", tags=["Git Version Control"])
    app.include_router(flashcards.router, prefix=f"{prefix}/flashcards", tags=["Flashcards"])
    app.include_router(certificates.router, prefix=f"{prefix}/certificates", tags=["Certificates"])
    app.include_router(analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"])
    app.include_router(admin.router, prefix=f"{prefix}/admin", tags=["Admin"])
    app.include_router(ai.router, prefix=f"{prefix}/ai", tags=["AI"])
    app.include_router(logs.router, prefix=f"{prefix}/logs", tags=["Logs"])
    app.include_router(course_builder.router, prefix=f"{prefix}/course-builder", tags=["Course Builder"])
    app.include_router(study_planner.router, prefix=f"{prefix}/study-planner", tags=["Study Planner"])

    # Include Version 3.0 Routers
    app.include_router(v3_search.router, prefix=prefix)
    app.include_router(v3_comms.router, prefix=prefix)
    app.include_router(v3_certificates.router, prefix=prefix)
    app.include_router(v3_ai.router, prefix=prefix)
    app.include_router(v3_analytics.router, prefix=prefix)

    # Include Version 4.0 Routers
    from routes import v4_admin
    app.include_router(v4_admin.router, prefix=prefix)


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
