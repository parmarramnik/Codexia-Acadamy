"""
End-to-end tests for the certificate flow:
completion -> issue -> store -> render PDF -> QR -> public verification.
"""

import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from config import settings
from database import Base, get_db
from main import app
from auth.jwt_handler import create_access_token
from models.user import User, UserRole
from models.course import Course, Enrollment, CourseCategory
from models.certificate import Certificate
from utils.cache import cache_invalidate_prefix

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    import models  # noqa: F401  register every table
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    cache_invalidate_prefix("certificates:")
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app, raise_server_exceptions=True)
    app.dependency_overrides.clear()


@pytest.fixture
def prod_frontend(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://learn.example-academy.app")
    return "https://learn.example-academy.app"


def _seed(db, completion=100.0):
    instructor = User(email="t@x.io", username="teacher", password_hash="x", full_name="Ada Lovelace",
                      role=UserRole.INSTRUCTOR, is_verified=True)
    student = User(email="s@x.io", username="student", password_hash="x", full_name="Grace Hopper",
                   role=UserRole.STUDENT, is_verified=True)
    db.add_all([instructor, student])
    db.flush()
    course = Course(title="Distributed Systems: Consensus, Replication & Fault Tolerance", slug="distributed-systems",
                    description="d", instructor_id=instructor.id, category=list(CourseCategory)[0],
                    is_published=True, is_approved=True, duration_hours=12.5, total_lectures=24)
    db.add(course)
    db.flush()
    db.add(Enrollment(user_id=student.id, course_id=course.id, completion_percentage=completion))
    db.commit()
    token = create_access_token({"sub": str(student.id)})
    return student, course, {"Authorization": f"Bearer {token}"}


def test_issue_render_and_verify(client, db_session, prod_frontend):
    student, course, auth = _seed(db_session)

    res = client.post(f"/api/certificates/{course.id}/generate", headers=auth)
    assert res.status_code == 200, res.text
    cert = res.json()
    uid = cert["certificate_uid"]
    assert re.fullmatch(r"CDX-\d{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}", cert["credential_id"])
    assert re.fullmatch(r"[0-9A-F]{4}(-[0-9A-F]{4}){3}", cert["verification_code"])
    assert cert["certificate_url"] == f"/api/certificates/{uid}/pdf"

    # Idempotent: claiming again returns the same certificate
    again = client.post(f"/api/certificates/{course.id}/generate", headers=auth).json()
    assert again["certificate_uid"] == uid

    # Public verification (no auth) by UUID and by credential ID (case-insensitive)
    for ident in (uid, cert["credential_id"].lower()):
        v = client.get(f"/api/certificates/{ident}/verify")
        assert v.status_code == 200, v.text
        body = v.json()
        assert body["status"] == "VERIFIED" and body["is_valid"] is True
        assert body["user_full_name"] == "Grace Hopper"
        assert body["verification_url"] == f"{prod_frontend}/verify/{uid}"

    legacy = client.get(f"/api/certificates/verify/{uid}").json()
    assert legacy["status"] == "VERIFIED" and legacy["recipient"] == "Grace Hopper"

    # PDF is rendered on demand (nothing on disk) and embeds the production verification URL
    pdf = client.get(f"/api/certificates/{uid}/pdf?download=true")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert "attachment" in pdf.headers["content-disposition"]
    assert pdf.content.startswith(b"%PDF")
    assert prod_frontend.encode() in pdf.content
    assert b"localhost" not in pdf.content

    qr = client.get(f"/api/certificates/{uid}/qr.svg")
    assert qr.status_code == 200 and qr.headers["content-type"].startswith("image/svg+xml")
    assert qr.text.startswith("<svg")


def test_not_eligible_and_unknown(client, db_session):
    _, course, auth = _seed(db_session, completion=40)
    res = client.post(f"/api/certificates/{course.id}/generate", headers=auth)
    assert res.status_code == 400
    assert client.get("/api/certificates/00000000-0000-4000-8000-000000000000/verify").status_code == 404
    assert client.get("/api/certificates/CDX-2026-AAAA-BBBB/pdf").status_code == 404


def test_tampered_and_revoked_records_fail(client, db_session):
    _, course, auth = _seed(db_session)
    uid = client.post(f"/api/certificates/{course.id}/generate", headers=auth).json()["certificate_uid"]

    cert = db_session.query(Certificate).filter_by(certificate_uid=uid).one()
    cert.user_full_name = "Someone Else"           # direct DB edit
    db_session.commit()
    body = client.get(f"/api/certificates/{uid}/verify").json()
    assert body["status"] == "INTEGRITY_FAILED" and body["is_valid"] is False
    assert client.get(f"/api/certificates/{uid}/pdf").status_code == 410

    cert.user_full_name = "Grace Hopper"
    cert.is_valid = False
    db_session.commit()
    assert client.get(f"/api/certificates/{uid}/verify").json()["status"] == "REVOKED"


def test_legacy_record_is_backfilled(client, db_session):
    student, course, _ = _seed(db_session)
    from datetime import datetime
    legacy = Certificate(user_id=student.id, course_id=course.id, user_full_name="Grace Hopper",
                         course_title=course.title, instructor_name="Ada Lovelace",
                         completion_date=datetime(2025, 3, 1, 10, 0, 0),
                         certificate_url="/static/certificates/certificate_old.pdf")
    db_session.add(legacy)
    db_session.commit()

    body = client.get(f"/api/certificates/{legacy.certificate_uid}/verify").json()
    assert body["status"] == "VERIFIED"
    assert body["credential_id"].startswith("CDX-2025-")
    assert body["certificate_url"].endswith("/pdf")


def test_qr_ignores_untrusted_referer(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:3000")
    _, course, auth = _seed(db_session)
    uid = client.post(f"/api/certificates/{course.id}/generate", headers=auth).json()["certificate_uid"]

    evil = client.get(f"/api/certificates/{uid}/verify", headers={"Referer": "https://evil.example.com/x"}).json()
    assert evil["verification_url"].startswith("http://localhost:3000/")

    trusted = client.get(f"/api/certificates/{uid}/verify",
                         headers={"Referer": "https://codexia-acadamy.vercel.app/certificates"}).json()
    assert trusted["verification_url"] == f"https://codexia-acadamy.vercel.app/verify/{uid}"


def test_claim_is_visible_immediately(client, db_session, prod_frontend):
    """Regression: the cached certificate list must be invalidated when a certificate is issued."""
    _, course, auth = _seed(db_session)
    assert client.get("/api/certificates", headers=auth).json() == []      # primes the cache
    client.post(f"/api/certificates/{course.id}/generate", headers=auth)
    assert len(client.get("/api/certificates", headers=auth).json()) == 1


def test_cache_prefix_invalidation_matches_exact_key():
    from utils.cache import cache_set, cache_get, cache_invalidate_prefix
    cache_set("t:user:1", "a"); cache_set("t:user:1:x", "b"); cache_set("t:user:10", "c")
    cache_invalidate_prefix("t:user:1")
    assert cache_get("t:user:1") is None and cache_get("t:user:1:x") is None
    assert cache_get("t:user:10") == "c"          # sibling ids are untouched
    cache_invalidate_prefix("t:")                  # trailing colon form
    assert cache_get("t:user:10") is None
