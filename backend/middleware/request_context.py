"""
Request correlation + access logging for every service.

Each request gets an X-Request-ID (taken from the caller when present, so one user action can be
followed across gateway -> service in the logs). Logs one line per request: method, path (no query
string, which may carry tokens), status and duration. Never logs headers or bodies.
"""
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("codexia.access")
_QUIET_PATHS = {"/health", "/health/ready", "/api/health"}


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, service: str = "api"):
        super().__init__(app)
        self.service = service

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("%s %s unhandled error rid=%s", request.method, request.url.path, request_id)
            raise
        response.headers["X-Request-ID"] = request_id
        if request.url.path not in _QUIET_PATHS:
            logger.info("svc=%s rid=%s %s %s -> %s %.0fms", self.service, request_id, request.method,
                        request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
        return response
