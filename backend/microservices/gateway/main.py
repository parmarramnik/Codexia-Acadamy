"""
API Gateway entrypoint for AI Learning Management System Microservices.
Port: 8000
Acts as a unified reverse proxy and entrypoint for all frontend API calls.
Routes incoming calls dynamically to the target microservices (Ports 8001-8006 or container endpoints).
"""

import sys
import os
import httpx
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, StreamingResponse

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from config import settings
from database import create_tables
from middleware.cors import setup_cors
from middleware.rate_limiter import setup_rate_limiter
from middleware.error_handler import setup_error_handlers
from utils.helpers import ensure_directory

SERVICE_PORT = 8000
SERVICE_NAME = "API Gateway"

# Microservice endpoints configuration with env fallbacks for Docker
SERVICE_MAP = {
    # Auth & Users -> Port 8001
    "auth": os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:8001"),
    "users": os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:8001"),
    
    # Courses & Content -> Port 8002
    "courses": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),
    "lectures": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),
    "course-builder": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),
    "notes": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),
    "flashcards": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),
    "study-planner": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),

    # Quizzes & Certificates -> Port 8003
    "quizzes": os.getenv("QUIZ_SERVICE_URL", "http://127.0.0.1:8003"),
    "certificates": os.getenv("QUIZ_SERVICE_URL", "http://127.0.0.1:8003"),

    # Coding & Git -> Port 8004
    "coding": os.getenv("CODING_SERVICE_URL", "http://127.0.0.1:8004"),
    "git": os.getenv("CODING_SERVICE_URL", "http://127.0.0.1:8004"),

    # AI Tutor & Assistant -> Port 8005
    "ai": os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8005"),

    # Analytics, Admin, Logs & Comms & Search -> Port 8006
    "analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "admin": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "logs": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "comms": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "search": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
}

# Version 3 & 4 routing rules
SPECIAL_PATH_MAP = {
    "/api/search": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "/api/v3/search": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "/api/v3/comms": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "/api/v3/analytics": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
    "/api/v3/certificates": os.getenv("QUIZ_SERVICE_URL", "http://127.0.0.1:8003"),
    "/api/v3/ai": os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8005"),
    "/api/v3/coding": os.getenv("CODING_SERVICE_URL", "http://127.0.0.1:8004"),
    "/api/v4/admin": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
}



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
    
    from starlette.middleware.gzip import GZipMiddleware
    app.add_middleware(GZipMiddleware, minimum_size=500)
    
    from middleware.security_headers import SecurityHeadersMiddleware
    app.add_middleware(SecurityHeadersMiddleware)

    # Static file serving across microservices
    static_dir = os.path.join(backend_dir, settings.UPLOAD_DIR)
    ensure_directory(static_dir)
    ensure_directory(os.path.join(static_dir, "videos"))
    ensure_directory(os.path.join(static_dir, "thumbnails"))
    ensure_directory(os.path.join(static_dir, "certificates"))
    ensure_directory(os.path.join(static_dir, "avatars"))
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Persistent HTTP connection pool for high-throughput, low-latency microservice proxying
    limits = httpx.Limits(max_keepalive_connections=30, max_connections=150, keepalive_expiry=30.0)
    http_client = httpx.AsyncClient(timeout=60.0, limits=limits, headers={"accept-encoding": "identity"})

    @app.on_event("startup")
    def on_startup():
        create_tables()

    @app.on_event("shutdown")
    async def on_shutdown():
        await http_client.aclose()

    @app.get("/", tags=["Root"])
    @app.get("/docs", include_in_schema=False)
    def root():
        return RedirectResponse(url="/api/docs")

    @app.get("/health", tags=["Health"])
    @app.get("/api/health", tags=["Health"])
    def health_check():
        return {
            "status": "healthy",
            "service": SERVICE_NAME,
            "port": SERVICE_PORT,
            "version": settings.APP_VERSION,
            "microservices": {
                "auth_service": os.getenv("AUTH_SERVICE_URL", "http://127.0.0.1:8001"),
                "course_service": os.getenv("COURSE_SERVICE_URL", "http://127.0.0.1:8002"),
                "quiz_service": os.getenv("QUIZ_SERVICE_URL", "http://127.0.0.1:8003"),
                "coding_service": os.getenv("CODING_SERVICE_URL", "http://127.0.0.1:8004"),
                "ai_service": os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8005"),
                "analytics_service": os.getenv("ANALYTICS_SERVICE_URL", "http://127.0.0.1:8006"),
            }
        }

    # Reverse proxy dispatcher
    @app.options("/api/{path:path}", include_in_schema=False)
    async def handle_preflight_options(path: str):
        return Response(status_code=200)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"])
    async def proxy_gateway(request: Request, path: str):
        target_base_url = None
        full_path = f"/api/{path}"

        # 1. Check special version paths
        for prefix, base_url in SPECIAL_PATH_MAP.items():
            if full_path.startswith(prefix):
                target_base_url = base_url
                break

        # 2. Check standard domain prefix
        if not target_base_url:
            path_segments = path.strip("/").split("/")
            domain = path_segments[0] if path_segments else ""
            target_base_url = SERVICE_MAP.get(domain)

        # Fallback to monolithic app routes if microservice is offline or local fallback enabled
        if not target_base_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No target microservice found for route '/api/{path}'"
            )

        target_url = f"{target_base_url}{request.url.path}"
        if request.url.query:
            target_url += f"?{request.url.query}"

        req_headers = dict(request.headers)
        req_headers.pop("host", None)
        req_headers["accept-encoding"] = "identity"

        body = await request.body()

        try:
            proxy_res = await http_client.request(
                method=request.method,
                url=target_url,
                headers=req_headers,
                content=body,
                follow_redirects=True,
            )

            # Strip encoding and transport headers case-insensitively
            excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"}
            res_headers = {k: v for k, v in proxy_res.headers.items() if k.lower() not in excluded_headers}

            return Response(
                content=proxy_res.content,
                status_code=proxy_res.status_code,
                headers=res_headers,
                media_type=proxy_res.headers.get("content-type"),
            )
        except httpx.ConnectError:
            # If standalone microservice port is not actively running, fallback to monolithic router in local dev mode
            from main import app as monolith_app
            from fastapi.testclient import TestClient
            with TestClient(monolith_app) as test_client:
                mono_res = test_client.request(
                    method=request.method,
                    url=request.url.path + ("?" + request.url.query if request.url.query else ""),
                    headers=dict(request.headers),
                    content=body,
                )
                return Response(
                    content=mono_res.content,
                    status_code=mono_res.status_code,
                    headers=dict(mono_res.headers),
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gateway routing error to '{target_url}': {str(e)}"
            )

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT, reload=settings.DEBUG)
