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


def test_login_success(client):
    """Test user login and token generation."""
    # First sign up
    client.post("/api/auth/signup", json={
        "email": "tester@test.com",
        "username": "tester",
        "full_name": "Test User",
        "password": "Password123!"
    })

    # Try login with email
    response = client.post("/api/auth/login", json={
        "email": "tester@test.com",
        "password": "Password123!"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_with_username_success(client):
    """Test user login using username field in payload."""
    client.post("/api/auth/signup", json={
        "email": "tester2@test.com",
        "username": "tester2",
        "full_name": "Test User 2",
        "password": "Password123!"
    })

    # Try login with username
    response = client.post("/api/auth/login", json={
        "username": "tester2",
        "password": "Password123!"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()



def test_login_invalid_password(client):
    """Test login failure with invalid password."""
    client.post("/api/auth/signup", json={
        "email": "tester@test.com",
        "username": "tester",
        "full_name": "Test User",
        "password": "Password123!"
    })

    # Expected response from the Value/Error handling triggers 401
    response = client.post("/api/auth/login", json={
        "email": "tester@test.com",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert "detail" in response.json()
