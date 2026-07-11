"""
Unit tests for course catalog and modules management.
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

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
      session.close()
      Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app, raise_server_exceptions=True)
    app.dependency_overrides.clear()


def test_list_courses_empty(client):
    """Test course listing when database has no courses."""
    response = client.get("/api/courses")
    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert len(response.json()["items"]) == 0
