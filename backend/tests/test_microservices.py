"""Microservice architecture: gateway routing, proxy behaviour, service isolation, production safety."""
import importlib
import os
import subprocess
import sys

import httpx
import pytest
from fastapi.testclient import TestClient

from config import settings
from microservices.gateway import main as gateway

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICES = ["auth", "course", "quiz", "coding", "ai", "analytics", "payment"]
SERVICE_ATTR = {"auth": "AUTH_SERVICE_URL", "course": "COURSE_SERVICE_URL", "quiz": "QUIZ_SERVICE_URL",
                "coding": "CODING_SERVICE_URL", "ai": "AI_SERVICE_URL", "analytics": "ANALYTICS_SERVICE_URL",
                "payment": "PAYMENT_SERVICE_URL"}


def service_paths(name):
    module = importlib.import_module(f"microservices.{name}_service.main")
    return {p for p in module.app.openapi()["paths"] if p.startswith("/api/")}


# --------------------------------------------------------------------------- routing coverage

def test_gateway_routes_every_monolith_endpoint_to_the_service_that_implements_it():
    import main as monolith
    owners = {name: service_paths(name) for name in SERVICES}
    mono = {p for p in monolith.app.openapi()["paths"] if p.startswith("/api/") and not p.startswith("/api/health")}
    unrouted, wrong = [], []
    for path in sorted(mono):
        implementing = [n for n, paths in owners.items() if path in paths]
        if not implementing:
            unrouted.append(path)
            continue
        expected = getattr(settings, SERVICE_ATTR[implementing[0]]).rstrip("/")
        if gateway.resolve(path) != expected:
            wrong.append((path, gateway.resolve(path), expected))
    assert not unrouted, f"endpoints missing from every service: {unrouted}"
    assert not wrong, f"gateway sends these to the wrong service: {wrong}"


def test_no_endpoint_is_implemented_by_two_services():
    seen = {}
    for name in SERVICES:
        for path in service_paths(name):
            assert path not in seen, f"{path} is served by both {seen[path]} and {name}"
            seen[path] = name


def test_payment_and_rag_endpoints_are_reachable_through_the_gateway():
    assert gateway.resolve("/api/payments/razorpay/webhook").endswith(":8007")
    assert gateway.resolve("/api/pricing/x").endswith(":8007")
    assert gateway.resolve("/api/rag/courses/1/documents").endswith(":8005")
    assert gateway.resolve("/api/unknown/thing") is None and gateway.resolve("/nope") is None


# --------------------------------------------------------------------------- proxy behaviour

class StreamingMock(httpx.AsyncBaseTransport):
    """Like httpx.MockTransport but leaves the response body unread, as a real network transport does."""

    def __init__(self, handler):
        self.handler = handler

    async def handle_async_request(self, request):
        await request.aread()
        reply = self.handler(request)
        return httpx.Response(reply.status_code, headers=reply.headers, stream=httpx.ByteStream(reply.content))


@pytest.fixture
def proxy(monkeypatch):
    """Gateway app wired to an in-memory upstream that records what it receives."""
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["method"], seen["headers"], seen["body"] = str(request.url), request.method, request.headers, request.read()
        behaviour = seen.get("behaviour")
        if behaviour == "refuse":
            raise httpx.ConnectError("down")
        if behaviour == "slow":
            raise httpx.ReadTimeout("slow")
        if behaviour == "video":
            return httpx.Response(206, content=b"0123456789", headers={"content-range": "bytes 0-9/100", "accept-ranges": "bytes", "content-type": "video/mp4"})
        return httpx.Response(200, json={"ok": True}, headers={"x-upstream": "yes", "set-cookie": "a=b", "connection": "close"})

    real = httpx.AsyncClient
    monkeypatch.setattr(gateway.httpx, "AsyncClient", lambda **kw: real(transport=StreamingMock(handler), **kw))
    app = gateway.create_app()
    with TestClient(app) as client:
        yield client, seen


def test_forwards_path_query_method_and_identity_headers(proxy):
    client, seen = proxy
    res = client.get("/api/courses?page=2&q=a b", headers={"Authorization": "Bearer t", "X-Request-ID": "rid-1"})
    assert res.status_code == 200 and res.json() == {"ok": True}
    assert seen["url"].startswith(settings.COURSE_SERVICE_URL) and "/api/courses?page=2" in seen["url"]
    assert seen["headers"]["authorization"] == "Bearer t" and seen["headers"]["x-request-id"] == "rid-1"
    assert seen["headers"]["x-forwarded-for"] and seen["headers"]["accept-encoding"] == "identity"
    assert res.headers["x-request-id"] == "rid-1" and res.headers["x-upstream"] == "yes"
    assert "connection" not in {k.lower() for k in res.headers if k.lower() == "connection" and res.headers[k] == "close"}


def test_request_body_is_forwarded_byte_exact_for_webhook_signatures(proxy):
    client, seen = proxy
    raw = b'{"event":"payment.captured","payload":{"x":"  spaced  ","u":"\\u00e9"}}'
    client.post("/api/payments/razorpay/webhook", content=raw,
                headers={"X-Razorpay-Signature": "abc123", "Content-Type": "application/json"})
    assert seen["body"] == raw and seen["headers"]["x-razorpay-signature"] == "abc123"
    assert seen["url"].startswith(settings.PAYMENT_SERVICE_URL)


def test_range_responses_pass_through_unchanged(proxy):
    client, seen = proxy
    seen["behaviour"] = "video"
    res = client.get("/api/lectures/1/stream", headers={"Range": "bytes=0-9"})
    assert res.status_code == 206 and res.content == b"0123456789"
    assert res.headers["content-range"] == "bytes 0-9/100" and seen["headers"]["range"] == "bytes=0-9"


def test_upstream_failures_become_clean_errors_not_a_monolith_fallback(proxy):
    client, seen = proxy
    seen["behaviour"] = "refuse"
    res = client.get("/api/courses")
    assert res.status_code == 503 and "unavailable" in res.json()["detail"] and res.headers["retry-after"]
    seen["behaviour"] = "slow"
    assert client.get("/api/ai/recommend").status_code == 504


def test_unknown_route_oversized_body_and_private_static_videos(proxy, monkeypatch):
    client, _ = proxy
    assert client.get("/api/nothing/here").status_code == 404
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 1)
    big = client.post("/api/lectures/1/upload", content=b"x" * (1024 * 1024 + 10))
    assert big.status_code == 413
    assert client.get("/static/videos/anything.mp4").status_code == 404  # only the signed, access-checked stream serves videos


def test_gateway_readiness_aggregates_services(monkeypatch):
    def handler(request):
        if request.url.port == 8005:
            return httpx.Response(503, json={"status": "unhealthy", "service": "AI Service", "components": {"cache": {"status": "unhealthy"}}})
        return httpx.Response(200, json={"status": "ready", "service": f"svc{request.url.port}",
                                         "components": {"database": {"status": "healthy"}}})

    real = httpx.AsyncClient
    monkeypatch.setattr(gateway.httpx, "AsyncClient", lambda **kw: real(transport=StreamingMock(handler), **kw))
    with TestClient(gateway.create_app()) as client:
        res = client.get("/api/health/ready")
    body = res.json()
    assert res.status_code == 503 and body["failed"] == ["AI Service"]
    assert body["components"]["database"]["status"] == "healthy" and len(body["services"]) == 7


# --------------------------------------------------------------------------- isolation and production safety

@pytest.mark.parametrize("name", ["auth", "course", "quiz", "coding", "analytics", "payment", "gateway"])
def test_services_other_than_ai_do_not_load_ml_libraries(name):
    module = f"microservices.{name}_service.main" if name != "gateway" else "microservices.gateway.main"
    code = f"import sys; import {module}; bad=[m for m in ('numpy','faiss','torch','sentence_transformers') if m in sys.modules]; sys.exit(1 if bad else 0)"
    result = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, capture_output=True, text=True,
                            env={**os.environ, "DEBUG": "true"})
    assert result.returncode == 0, result.stderr[-500:]


def test_production_settings_are_validated(monkeypatch):
    from config import validate_production_settings
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "change-this-in-production-use-a-strong-random-key")
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///./x.db")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:3000")
    with pytest.raises(RuntimeError) as err:
        validate_production_settings()
    for fragment in ("JWT_SECRET_KEY", "PostgreSQL", "FRONTEND_URL"):
        assert fragment in str(err.value)
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "x" * 48)
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql://u:p@db/x")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://app.example.com")
    validate_production_settings()  # no exception
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "short")
    validate_production_settings()  # debug mode never blocks


def _run_seed(tmp_path, snippet, **env):
    db = tmp_path / "seed.db"
    code = ("from seed_db import seed_database\nfrom database import SessionLocal\nfrom models.user import User\n"
            "from auth.password import hash_password\n" + snippet)
    return subprocess.run([sys.executable, "-W", "ignore", "-c", code], cwd=BACKEND, capture_output=True, text=True,
                          env={**os.environ, "DATABASE_URL": f"sqlite:///{db}", **env})


def test_production_seed_creates_no_demo_accounts(tmp_path):
    result = _run_seed(tmp_path, "seed_database()\ndb=SessionLocal()\nprint('USERS', db.query(User).count())", DEBUG="false")
    assert "USERS 0" in result.stdout, result.stdout[-400:] + result.stderr[-400:]


def test_seeding_never_resets_an_existing_accounts_password(tmp_path):
    snippet = (
        "from models.user import UserRole\nfrom database import create_tables\ncreate_tables()\n"
        "db=SessionLocal()\ndb.add(User(email='admin@gmail.com',username='admin',password_hash=hash_password('Real-Secret-9!'),"
        "full_name='Real Admin',role=UserRole.ADMIN,is_verified=True)); db.commit()\n"
        "seed_database(demo_data=True)\ndb=SessionLocal()\nu=db.query(User).filter(User.email=='admin@gmail.com').one()\n"
        "from auth.password import verify_password\nprint('KEPT', verify_password('Real-Secret-9!', u.password_hash), u.full_name)"
    )
    result = _run_seed(tmp_path, snippet, DEBUG="true")
    assert "KEPT True Real Admin" in result.stdout, result.stdout[-500:] + result.stderr[-500:]


def test_bootstrap_creates_admin_once_without_touching_existing(tmp_path):
    snippet = (
        "from config import settings\nsettings.ADMIN_BOOTSTRAP_EMAIL='boss@example.com'\n"
        "settings.ADMIN_BOOTSTRAP_PASSWORD='Str0ng-Pass-123!'\n"
        "from database import create_tables\ncreate_tables()\nfrom scripts.bootstrap import ensure_admin\n"
        "ensure_admin()\nensure_admin()\ndb=SessionLocal()\nus=db.query(User).filter(User.email=='boss@example.com').all()\n"
        "print('ADMINS', len(us), us[0].role.value, us[0].is_verified)"
    )
    result = _run_seed(tmp_path, snippet, DEBUG="false")
    assert "ADMINS 1 admin True" in result.stdout, result.stdout[-500:] + result.stderr[-500:]


def test_cors_allows_only_configured_origins_in_production(monkeypatch):
    from fastapi import FastAPI
    from middleware.cors import setup_cors

    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "CORS_ORIGINS", "https://app.example.com")
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.example.com/")
    app = FastAPI()
    setup_cors(app)

    @app.get("/x")
    def x():
        return {}

    client = TestClient(app)

    def allowed(origin):
        res = client.options("/x", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
        return res.headers.get("access-control-allow-origin") == origin

    assert allowed("https://app.example.com") and allowed("https://www.example.com")
    assert not allowed("https://evil.vercel.app")          # no wildcard hosting domains
    assert not allowed("http://localhost:3000")            # no localhost in production
    monkeypatch.setattr(settings, "DEBUG", True)
    dev = FastAPI()
    setup_cors(dev)
    res = TestClient(dev).options("/x", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
