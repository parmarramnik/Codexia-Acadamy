"""
Regression tests for authentication and access-control fixes:
self-service role limits, OTP and verification-link flows, session handling after verification
and password reset, username lockout, and ownership checks on flashcards, quizzes and note branches.
"""

import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401  (register every table)
import utils.email_service as email_service
from auth.password import hash_password
from config import settings
from database import Base, get_db
from main import app
from models.course import Course, CourseCategory
from models.quiz import Quiz
from models.user import User, UserRole

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

PASSWORD = "Password123!"


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sent_emails(monkeypatch):
    """Capture outgoing mail instead of sending it."""
    sent = []
    monkeypatch.setattr(email_service, "send_email",
                        lambda subject, recipient, body_html, body_text: sent.append(recipient) or True)
    return sent


@pytest.fixture
def client(db, sent_emails):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    app.state.limiter.reset()
    yield TestClient(app)
    app.dependency_overrides.clear()
    app.state.limiter.reset()


def make_user(db, username, role=UserRole.STUDENT, verified=True):
    user = User(email=f"{username}@example.com", username=username, full_name=username.title(),
                password_hash=hash_password(PASSWORD), role=role, is_verified=verified)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(client, identifier):
    response = client.post("/api/auth/login", json={"email": identifier, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- signup and verification

@pytest.mark.parametrize("role", ["admin", "super_admin"])
def test_signup_cannot_request_an_admin_role(client, db, role):
    response = client.post("/api/auth/signup", json={"email": "newcomer@example.com", "password": PASSWORD,
                                                       "role": role})
    assert response.status_code == 400
    assert db.query(User).filter(User.email == "newcomer@example.com").first() is None


def test_signup_still_allows_student_and_instructor(client):
    for index, role in enumerate(("student", "instructor")):
        response = client.post("/api/auth/signup", json={"email": f"person{index}@example.com",
                                                           "password": PASSWORD, "role": role})
        assert response.status_code == 201
        assert response.json()["role"] == role


def test_verification_link_for_instructor_goes_to_the_approver(client, db, sent_emails, monkeypatch):
    monkeypatch.setattr(settings, "INSTRUCTOR_EMAIL", "approver@example.com")
    make_user(db, "teacher", role=UserRole.INSTRUCTOR, verified=False)

    response = client.post("/api/auth/resend-verification", json={"email": "teacher@example.com"})

    assert response.status_code == 200
    assert sent_emails[-1] == "approver@example.com"


def test_verify_otp_never_issues_tokens_for_an_already_verified_account(client, db):
    make_user(db, "verified")

    response = client.post("/api/auth/verify-otp", json={"email": "verified@example.com", "otp": "000000"})

    assert response.status_code == 400
    assert "access_token" not in response.json()


def test_tokens_from_otp_verification_can_be_refreshed(client, db):
    user = make_user(db, "fresh", verified=False)
    user.verification_otp = "123456"
    db.commit()

    verified = client.post("/api/auth/verify-otp", json={"email": "fresh@example.com", "otp": "123456"})
    assert verified.status_code == 200

    time.sleep(1.1)  # a token minted in the same second as the original would be byte-identical
    refreshed = client.post("/api/auth/refresh", json={"refresh_token": verified.json()["refresh_token"]})
    assert refreshed.status_code == 200


# --------------------------------------------------------------------------- password reset and lockout

def test_password_reset_signs_out_existing_tokens(client, db):
    user = make_user(db, "forgetful")
    old_access = login(client, "forgetful@example.com")["access_token"]

    client.post("/api/auth/forgot-password", json={"email": "forgetful@example.com"})
    db.refresh(user)
    reset = client.post("/api/auth/reset-password", json={"email": "forgetful@example.com", "otp": user.reset_token,
                                                            "new_password": "BrandNew123!"})
    assert reset.status_code == 200

    assert client.get("/api/users/me", headers=bearer(old_access)).status_code == 401


def test_failed_logins_by_username_count_towards_lockout(db):
    from services.session_service import record_login_attempt

    user = make_user(db, "byname")
    for _ in range(5):
        record_login_attempt(db, "byname", "failed", "127.0.0.1", "TestBot", "Wrong password")

    db.refresh(user)
    assert user.failed_login_attempts == 5
    assert user.lockout_until is not None


# --------------------------------------------------------------------------- ownership checks

@pytest.fixture
def course(db):
    owner = make_user(db, "owner", role=UserRole.INSTRUCTOR)
    course = Course(title="Owned Course", slug="owned-course", description="A course used by ownership tests",
                    instructor_id=owner.id, category=CourseCategory.PROGRAMMING, is_published=True, is_approved=True)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def test_users_cannot_edit_each_others_flashcards(client, db, course):
    make_user(db, "alice")
    make_user(db, "bob")
    alice, bob = login(client, "alice")["access_token"], login(client, "bob")["access_token"]
    card = client.post("/api/flashcards", json={"course_id": course.id, "question": "What is a list?",
                                                "answer": "A sequence"}, headers=bearer(alice)).json()

    assert client.patch(f"/api/flashcards/{card['id']}", json={"question": "Changed by Bob"},
                        headers=bearer(bob)).status_code == 404
    assert client.patch(f"/api/flashcards/{card['id']}", json={"is_learned": True},
                        headers=bearer(alice)).status_code == 200


def test_only_the_course_owner_or_an_admin_can_change_a_quiz(client, db, course):
    quiz = Quiz(course_id=course.id, title="Owned quiz", max_attempts=3)
    db.add(quiz)
    db.commit()
    make_user(db, "stranger", role=UserRole.INSTRUCTOR)
    make_user(db, "boss", role=UserRole.ADMIN)
    stranger = login(client, "stranger")["access_token"]
    owner = login(client, "owner")["access_token"]
    admin = login(client, "boss")["access_token"]

    assert client.put(f"/api/quizzes/{quiz.id}", json={"title": "Hijacked"}, headers=bearer(stranger)).status_code == 403
    assert client.delete(f"/api/quizzes/{quiz.id}", headers=bearer(stranger)).status_code == 403
    assert client.put(f"/api/quizzes/{quiz.id}", json={"title": "Renamed"}, headers=bearer(owner)).status_code == 200
    assert client.delete(f"/api/quizzes/{quiz.id}", headers=bearer(admin)).status_code == 200


def test_merge_rejects_a_branch_from_another_users_note(client, db):
    make_user(db, "alice")
    make_user(db, "bob")
    alice, bob = login(client, "alice")["access_token"], login(client, "bob")["access_token"]
    alice_note = client.post("/api/notes", json={"title": "Alice", "content": "private"}, headers=bearer(alice)).json()
    bob_note = client.post("/api/notes", json={"title": "Bob", "content": "mine"}, headers=bearer(bob)).json()
    client.post("/api/git/commit", json={"note_id": alice_note["id"], "message": "first"}, headers=bearer(alice))
    client.post("/api/git/commit", json={"note_id": bob_note["id"], "message": "first"}, headers=bearer(bob))

    def main_branch(note_id, token):
        branches = client.get("/api/git/branches", params={"note_id": note_id}, headers=bearer(token)).json()
        return next(b["id"] for b in branches if b["name"] == "main")

    response = client.post("/api/git/merge", json={
        "note_id": bob_note["id"], "source_branch_id": main_branch(alice_note["id"], alice),
        "target_branch_id": main_branch(bob_note["id"], bob), "resolve_strategy": "keep_source",
    }, headers=bearer(bob))

    assert response.status_code == 404
