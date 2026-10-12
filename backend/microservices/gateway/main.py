"""
API gateway: the only service reachable from outside. Port 8000.

* Routes /api/<segment>/... to the owning microservice (table below; a test asserts it covers every route).
* Streams request and response bodies (large uploads, video Range requests) instead of buffering them.
* Forwards the real client IP and a request id so per-service rate limits and logs are accurate.
* Serves public static files (avatars, thumbnails, certificates). Uploaded lecture videos are NOT served
  from here: they stream through the course service's signed, access-checked endpoint.
* /api/health/ready aggregates every service's readiness.
* There is deliberately no in-process fallback to the monolith: a down service is a 503, not a silent
  second copy of the whole application.
"""
import asyncio
import logging
import os
import sys
from typing import Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response, StreamingResponse
from starlette.background import BackgroundTask

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from config import settings, validate_production_settings  # noqa: E402
from middleware.cors import setup_cors  # noqa: E402
from middleware.request_context import RequestContextMiddleware  # noqa: E402
from middleware.security_headers import SecurityHeadersMiddleware  # noqa: E402
from utils.helpers import ensure_directory  # noqa: E402
from utils.media_access import PublicStaticFiles  # noqa: E402

logger = logging.getLogger("codexia.gateway")

SERVICE_NAME = "API Gateway"
SERVICE_PORT = 8000

# First path segment after /api  ->  name of the Settings attribute holding the owning service's URL.
ROUTES = {
    "auth": "AUTH_SERVICE_URL", "users": "AUTH_SERVICE_URL",
    "courses": "COURSE_SERVICE_URL", "lectures": "COURSE_SERVICE_URL", "course-builder": "COURSE_SERVICE_URL",
    "notes": "COURSE_SERVICE_URL", "flashcards": "COURSE_SERVICE_URL", "study-planner": "COURSE_SERVICE_URL",
    "quizzes": "QUIZ_SERVICE_URL", "certificates": "QUIZ_SERVICE_URL",
    "coding": "CODING_SERVICE_URL", "git": "CODING_SERVICE_URL",
    "ai": "AI_SERVICE_URL", "rag": "AI_SERVICE_URL",
    "analytics": "ANALYTICS_SERVICE_URL", "admin": "ANALYTICS_SERVICE_URL", "logs": "ANALYTICS_SERVICE_URL",
    "comms": "ANALYTICS_SERVICE_URL", "search": "ANALYTICS_SERVICE_URL",
    "payments": "PAYMENT_SERVICE_URL", "pricing": "PAYMENT_SERVICE_URL",
}
SERVICE_ATTRS = sorted(set(ROUTES.values()))

# Per-segment read timeouts (seconds): AI calls and code runs legitimately take long.
READ_TIMEOUTS = {"ai": 120.0, "rag": 120.0, "coding": 120.0, "lectures": 600.0, "courses": 600.0}
DEFAULT_READ_TIMEOUT = 60.0

HOP_BY_HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers",
              "transfer-encoding", "upgrade", "host"}


def resolve(path: str) -> Optional[str]:
    """Base URL of the service owning `/api/<segment>/...`, or None."""
    parts = path.strip("/").split("/")
    if len(parts) < 2 or parts[0] != "api":
        return None
    attr = ROUTES.get(parts[1])
    return getattr(settings, attr).rstrip("/") if attr else None


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.APP_NAME} - {SERVICE_NAME}",
        version=settings.APP_VERSION,
        docs_url=None, redoc_url=None, openapi_url=None,
    )
    setup_cors(app)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware, service="gateway")

    static_dir = os.path.join(backend_dir, settings.UPLOAD_DIR)
    for sub in ("", "thumbnails", "certificates", "avatars", "videos"):
        ensure_directory(os.path.join(static_dir, sub))
    app.mount("/static", PublicStaticFiles(directory=static_dir), name="static")

    client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=DEFAULT_READ_TIMEOUT, write=300.0, pool=10.0),
        limits=httpx.Limits(max_keepalive_connections=50, max_connections=300, keepalive_expiry=30.0),
        follow_redirects=False,
    )

    @app.on_event("startup")
    def _startup():
        validate_production_settings()
        logger.info("Gateway routing: %s", {a: getattr(settings, a) for a in SERVICE_ATTRS})

    @app.on_event("shutdown")
    async def _shutdown():
        await client.aclose()

    @app.get("/", include_in_schema=False)
    def _root():
        return RedirectResponse(url="/api/health")

    @app.get("/health", tags=["Health"])
    @app.get("/api/health", tags=["Health"])
    def health():
        """Liveness of the gateway itself."""
        return {"status": "healthy", "service": SERVICE_NAME, "version": settings.APP_VERSION}

    @app.get("/api/health/ready", tags=["Health"])
    async def ready():
        """Readiness of the whole platform: every service's /health/ready, merged."""
        async def probe(attr: str):
            url = getattr(settings, attr).rstrip("/")
            try:
                res = await client.get(f"{url}/health/ready", timeout=4.0)
                return attr, res.status_code, res.json()
            except Exception as exc:  # noqa: BLE001
                return attr, 0, {"status": "unreachable", "detail": type(exc).__name__}

        results = await asyncio.gather(*(probe(a) for a in SERVICE_ATTRS))
        services, components, failed = {}, {}, []
        for attr, code, body in results:
            name = body.get("service") or attr.replace("_URL", "").replace("_SERVICE", "").lower()
            ok = code == 200
            services[name] = {"status": "ready" if ok else body.get("status", "unhealthy")}
            if not ok:
                failed.append(name)
            for comp, info in (body.get("components") or {}).items():
                prior = components.get(comp)
                # keep the worst status when several services report the same component (database, cache)
                if prior is None or info.get("status") == "unhealthy":
                    components[comp] = info
        return JSONResponse(status_code=503 if failed else 200,
                            content={"status": "unhealthy" if failed else "ready", "failed": failed,
                                     "services": services, "components": components})

    @app.options("/api/{path:path}", include_in_schema=False)
    async def _preflight(path: str):
        return Response(status_code=204)  # CORSMiddleware answers real preflights; this is a safety net

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    async def proxy(request: Request, path: str):
        base = resolve(request.url.path)
        request_id = getattr(request.state, "request_id", "-")
        if base is None:
            return JSONResponse(status_code=404, content={"detail": f"No service handles '/api/{path}'"})

        max_body = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > max_body:
            return JSONResponse(status_code=413, content={"detail": f"Request body exceeds {settings.MAX_UPLOAD_SIZE_MB} MB"})

        headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP}
        headers["accept-encoding"] = "identity"   # upstream bodies stay byte-exact; compression is the edge's job
        headers["x-forwarded-for"] = _client_ip(request)
        headers["x-forwarded-proto"] = request.headers.get("x-forwarded-proto", request.url.scheme)
        headers["x-forwarded-host"] = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
        headers["x-request-id"] = request_id

        segment = request.url.path.split("/")[2]
        timeout = httpx.Timeout(connect=5.0, read=READ_TIMEOUTS.get(segment, DEFAULT_READ_TIMEOUT), write=300.0, pool=10.0)
        has_body = request.method in ("POST", "PUT", "PATCH", "DELETE") and (
            declared not in (None, "0") or "transfer-encoding" in request.headers)
        url = base + request.url.path + (f"?{request.url.query}" if request.url.query else "")
        try:
            upstream = await client.send(
                client.build_request(request.method, url, headers=headers, timeout=timeout,
                                     content=request.stream() if has_body else None),
                stream=True,
            )
        except httpx.ConnectError:
            logger.error("rid=%s upstream %s unreachable", request_id, base)
            return JSONResponse(status_code=503, content={"detail": "This service is temporarily unavailable.", "request_id": request_id},
                                headers={"Retry-After": "5"})
        except httpx.TimeoutException:
            logger.error("rid=%s upstream %s timed out", request_id, base)
            return JSONResponse(status_code=504, content={"detail": "The service took too long to respond.", "request_id": request_id})
        except httpx.HTTPError as exc:
            logger.error("rid=%s upstream error %s", request_id, type(exc).__name__)
            return JSONResponse(status_code=502, content={"detail": "Bad gateway.", "request_id": request_id})

        response_headers = {k: v for k, v in upstream.headers.items()
                            if k.lower() not in HOP_BY_HOP and k.lower() != "content-encoding"}
        return StreamingResponse(upstream.aiter_raw(), status_code=upstream.status_code,
                                 headers=response_headers, background=BackgroundTask(upstream.aclose))

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)
