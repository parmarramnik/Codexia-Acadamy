"""
Unit tests for authentication and authorization.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

# Import all models to register them on Base.metadata
from models.user import User, Role, Permission, RolePermission
from models.course import Course, Module, Lecture, Enrollment, Category
from models.content import Video, Resource, Note, Flashcard, Bookmark
from models.quiz import Quiz, Question, Answer, QuizAttempt, QuizResponse
from models.coding import CodingProblem, TestCase, Submission
from models.analytics import Progress, StudySession, Notification, Announcement, ChatHistory
from models.certificate import Certificate
from models.audit import AuditLog, SecurityLog

# Use in-memory SQLite database with StaticPool for thread safety
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for a test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with db session override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app, raise_server_exceptions=True)
    app.dependency_overrides.clear()


def _verify_user(db_session, email: str):
    """Helper: mark a test user as verified so login tests pass the verification gate."""
    user = db_session.query(User).filter(User.email == email).first()
    if user:
        user.is_verified = True
        db_session.commit()


def test_signup_success(client):
    """Test user signup endpoint."""
    response = client.post("/api/auth/signup", json={
        "email": "tester@test.com",
        "username": "tester",
        "full_name": "Test User",
        "password": "Password123!"
    })
    assert response.status_code == 201
    assert response.json()["email"] == "tester@test.com"
    assert "id" in response.json()


def test_signup_without_username_and_fullname(client):
    """Test signup with only email and password (omitting username & full_name)."""
    response = client.post("/api/auth/signup", json={
        "email": "student_user1@example.com",
        "password": "Password123!"
    })
    assert response.status_code == 201
    assert response.json()["email"] == "student_user1@example.com"
    assert response.json()["username"] == "student_user1"



def test_login_success(client, db_session):
    """Test user login and token generation."""
    # First sign up
    client.post("/api/auth/signup", json={
        "email": "tester@test.com",
        "username": "tester",
        "full_name": "Test User",
        "password": "Password123!"
    })
    _verify_user(db_session, "tester@test.com")

    # Try login with email
    response = client.post("/api/auth/login", json={
        "email": "tester@test.com",
        "password": "Password123!"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_with_username_success(client, db_session):
    """Test user login using username field in payload."""
    client.post("/api/auth/signup", json={
        "email": "tester2@test.com",
        "username": "tester2",
        "full_name": "Test User 2",
        "password": "Password123!"
    })
    _verify_user(db_session, "tester2@test.com")

    # Try login with username
    response = client.post("/api/auth/login", json={
        "username": "tester2",
        "password": "Password123!"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()



def test_login_invalid_password(client, db_session):
    """Test login failure with invalid password."""
    client.post("/api/auth/signup", json={
        "email": "tester@test.com",
        "username": "tester",
        "full_name": "Test User",
        "password": "Password123!"
    })
    _verify_user(db_session, "tester@test.com")

    # Expected response from the Value/Error handling triggers 401
    response = client.post("/api/auth/login", json={
        "email": "tester@test.com",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert "detail" in response.json()


def test_failed_login_lockout(db_session):
    """Verify account lockout after multiple failed login attempts."""
    from services.auth_service import authenticate_user
    from services.session_service import record_login_attempt
    from services.user_service import create_user
    from schemas.user import UserCreate

    test_email = "lockout_test@example.com"
    user_data = UserCreate(
        email=test_email,
        username="lockout_test",
        full_name="Lockout Test User",
        password="Password123!",
        role="student",
    )
    user = create_user(db_session, user_data)
    assert authenticate_user(db_session, test_email, "Password123!") is not None

    for _ in range(5):
        record_login_attempt(db_session, test_email, "failed", "127.0.0.1", "TestBot", "Wrong password")

    db_session.refresh(user)
    assert user.failed_login_attempts == 5
    assert user.lockout_until is not None

    with pytest.raises(ValueError, match="Account locked out"):
        authenticate_user(db_session, test_email, "Password123!")


def test_session_rotation(db_session):
    """Verify session tracking upon login."""
    from services.auth_service import login_user
    from services.session_service import get_active_sessions
    from services.user_service import create_user
    from schemas.user import UserCreate

    test_email = "session_test@example.com"
    user_data = UserCreate(
        email=test_email,
        username="session_test",
        full_name="Session Test User",
        password="Password123!",
        role="student",
    )
    user = create_user(db_session, user_data)
    login_user(db_session, test_email, "Password123!", ip_address="192.168.1.5", user_agent="Firefox")

    sessions = get_active_sessions(db_session, user.id)
    assert len(sessions) == 1
    assert sessions[0].ip_address == "192.168.1.5"
    assert sessions[0].user_agent == "Firefox"



def test_login_uses_one_session_policy_and_ignores_legacy_remember_me(db_session):
    """The 7-day 'remember me' option is gone: a stale client sending it gets the standard 1-day session."""
    import inspect
    from datetime import datetime, timedelta, timezone
    from schemas.user import UserCreate, UserLogin
    from services.auth_service import login_user, SESSION_LIFETIME_DAYS
    from services.session_service import get_active_sessions
    from services.user_service import create_user

    assert "remember_me" not in inspect.signature(login_user).parameters
    assert "remember_me" not in UserLogin.model_fields
    legacy_payload = UserLogin(email="a@b.co", password="Password123!", remember_me=True)  # extra field ignored
    assert not hasattr(legacy_payload, "remember_me")

    user = create_user(db_session, UserCreate(email="one_policy@example.com", username="one_policy",
                                              full_name="One Policy", password="Password123!", role="student"))
    login_user(db_session, "one_policy@example.com", "Password123!", ip_address="10.0.0.1", user_agent="UA")
    (session,) = get_active_sessions(db_session, user.id)
    expires = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
    remaining = expires - datetime.now(timezone.utc)
    assert SESSION_LIFETIME_DAYS == 1
    assert timedelta(hours=23) < remaining <= timedelta(days=1, minutes=1)
