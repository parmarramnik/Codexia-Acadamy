"""
FastAPI application entry point.
Registers all middleware, routes, and startup events.
"""

from fastapi import FastAPI
import os

from config import settings, validate_production_settings
from database import create_tables
from middleware.cors import setup_cors
from middleware.rate_limiter import setup_rate_limiter
from middleware.error_handler import setup_error_handlers
from utils.helpers import ensure_directory
from utils.media_access import PublicStaticFiles


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
    from starlette.middleware.gzip import GZipMiddleware
    app.add_middleware(GZipMiddleware, minimum_size=500)
    from middleware.security_headers import SecurityHeadersMiddleware
    app.add_middleware(SecurityHeadersMiddleware)

    # Static file serving
    static_dir = os.path.join(os.path.dirname(__file__), settings.UPLOAD_DIR)
    ensure_directory(static_dir)
    ensure_directory(os.path.join(static_dir, "videos"))
    ensure_directory(os.path.join(static_dir, "thumbnails"))
    ensure_directory(os.path.join(static_dir, "certificates"))
    ensure_directory(os.path.join(static_dir, "avatars"))
    # Uploaded lecture videos are excluded: they are only served through the signed,
    # access-checked /api/lectures/{id}/stream route so paid content cannot be fetched directly.
    app.mount("/static", PublicStaticFiles(directory=static_dir), name="static")

    # Register routes
    register_routes(app)

    # Startup event
    @app.on_event("startup")
    def on_startup():
        validate_production_settings()
        create_tables()
        from services.payment_service import start_background_reconciler
        start_background_reconciler()
        # Documents left PROCESSING by a restart can never finish on their own: surface them for re-indexing.
        try:
            from ai.rag.service import recover_interrupted_documents
            recover_interrupted_documents()
        except Exception as recover_err:
            import logging
            logging.getLogger("uvicorn.error").warning(f"RAG recovery check skipped: {recover_err}")
        # Automatically guarantee the 5 courses, RBAC, and 20 DSA coding problems are seeded on deployment
        try:
            from seed_db import seed_database
            seed_database()
            from scripts.bootstrap import ensure_admin
            ensure_admin()
        except Exception as seed_err:
            import logging
            logging.getLogger("uvicorn.error").warning(f"Auto-seeding check on startup: {seed_err}")

    # Root redirect to API Docs
    from fastapi.responses import RedirectResponse
    @app.get("/", tags=["Root"])
    def root_redirect():
        """Redirect the root request directly to the Swagger API documentation."""
        return RedirectResponse(url="/api/docs")

    # Health check (liveness: the process is up; cheap, no dependencies)
    @app.get("/api/health", tags=["Health"])
    def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    # Readiness: reports real dependency status. 503 only when a REQUIRED dependency is down.
    @app.get("/api/health/ready", tags=["Health"])
    def readiness():
        from fastapi.responses import JSONResponse
        from sqlalchemy import text
        from database import engine
        from utils.cache import cache_status
        from services import code_runner
        import importlib.util

        components = {}
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            components["database"] = {"status": "healthy"}
        except Exception as exc:  # noqa: BLE001
            components["database"] = {"status": "unhealthy", "detail": type(exc).__name__}
        components["cache"] = cache_status()
        runner = code_runner.health() if settings.DEBUG is False or settings.JUDGE0_URL else {"status": "dev-only"}
        components["code_execution"] = {"status": runner["status"], **({"provider": runner["provider"]} if "provider" in runner else {})}
        packages = {name: importlib.util.find_spec(name) is not None for name in ("faiss", "sentence_transformers")}
        components["rag"] = {"status": "configured" if settings.RAG_ENABLED and all(packages.values()) else
                             ("disabled" if not settings.RAG_ENABLED else "unavailable"),
                             "model": settings.EMBEDDING_MODEL, "packages_installed": packages}
        components["ai"] = {"status": "configured" if settings.GEMINI_API_KEY else "not_configured"}
        components["payments"] = {"status": "configured" if settings.payments_configured else "not_configured",
                                  "webhook_secret": bool(settings.RAZORPAY_WEBHOOK_SECRET)}
        failed = [n for n, c in components.items() if c["status"] == "unhealthy"]
        return JSONResponse(status_code=503 if failed else 200,
                            content={"status": "unhealthy" if failed else "ready", "failed": failed,
                                     "components": components})

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

    # RAG document management (course owners/admins)
    from routes import rag
    app.include_router(rag.router, prefix=f"{prefix}/rag", tags=["RAG"])

    # Payments (Razorpay) & course pricing
    from routes import payments, pricing
    app.include_router(payments.router, prefix=f"{prefix}/payments", tags=["Payments"])
    app.include_router(pricing.router, prefix=f"{prefix}/pricing", tags=["Pricing"])


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)
