"""
Regression tests for: quiz scoring limited to the quiz's own questions, HTML-escaped note diffs,
admin access to the search admin endpoints, and study time credited only for watched minutes.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401  (register every table)
from auth.password import hash_password
from database import Base, get_db
from main import app
from models.analytics import StudySession
from models.course import Course, CourseCategory, Lecture, Module
from models.quiz import Answer, Question, QuestionType, Quiz
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
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    app.state.limiter.reset()
    yield TestClient(app)
    app.dependency_overrides.clear()
    app.state.limiter.reset()


def make_user(db, username, role=UserRole.STUDENT):
    user = User(email=f"{username}@example.com", username=username, full_name=username.title(),
                password_hash=hash_password(PASSWORD), role=role, is_verified=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def token_for(client, username):
    response = client.post("/api/auth/login", json={"email": username, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def course(db):
    owner = make_user(db, "owner", role=UserRole.INSTRUCTOR)
    course = Course(title="Course", slug="course", description="A course used by these tests",
                    instructor_id=owner.id, category=CourseCategory.PROGRAMMING, is_published=True, is_approved=True)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


# --------------------------------------------------------------------------- quiz scoring

def _quiz_with_one_correct_answer(db, course, title):
    quiz = Quiz(course_id=course.id, title=title, total_marks=2, passing_percentage=50, max_attempts=5)
    db.add(quiz)
    db.flush()
    first = Question(quiz_id=quiz.id, question_type=QuestionType.MCQ, content="1 + 1?", marks=1)
    second = Question(quiz_id=quiz.id, question_type=QuestionType.MCQ, content="2 + 2?", marks=1)
    db.add_all([first, second])
    db.flush()
    correct = Answer(question_id=first.id, content="2", is_correct=True)
    db.add_all([correct, Answer(question_id=second.id, content="4", is_correct=True)])
    db.commit()
    return quiz, first, correct


def test_repeating_a_correct_answer_scores_it_once(client, db, course):
    make_user(db, "learner")
    quiz, question, correct = _quiz_with_one_correct_answer(db, course, "Repeat")
    payload = {"responses": [{"question_id": question.id, "selected_answer_ids": [correct.id]}] * 10}

    result = client.post(f"/api/quizzes/{quiz.id}/attempt", json=payload, headers=token_for(client, "learner"))

    assert result.status_code == 200
    assert result.json()["score"] == 1
    assert result.json()["percentage"] == 50


def test_questions_from_another_quiz_are_ignored(client, db, course):
    make_user(db, "learner")
    target, _, _ = _quiz_with_one_correct_answer(db, course, "Target")
    _, other_question, other_correct = _quiz_with_one_correct_answer(db, course, "Other")
    payload = {"responses": [{"question_id": other_question.id, "selected_answer_ids": [other_correct.id]}]}

    result = client.post(f"/api/quizzes/{target.id}/attempt", json=payload, headers=token_for(client, "learner"))

    assert result.status_code == 200
    assert result.json()["score"] == 0


# --------------------------------------------------------------------------- note diff escaping

def test_note_diff_escapes_note_text_but_keeps_highlight_markup():
    from services.git_service import compute_side_by_side_diff

    before = "plain line\nhello <b>world</b>\n<img src=x onerror=alert(1)>"
    after = "plain line\nhello <i>there</i>\n<script>alert(1)</script>\nnew & improved"
    hunks = compute_side_by_side_diff(before, after)
    rendered = " ".join(h["left"] or "" for h in hunks) + " " + " ".join(h["right"] or "" for h in hunks)

    for raw in ("<img", "<script", "<b>", "<i>", " & "):
        assert raw not in rendered
    assert "&lt;script&gt;" in rendered and "&amp;" in rendered
    assert "<span class='diff-word-added'>" in rendered  # diff highlighting is still real markup


# --------------------------------------------------------------------------- search admin endpoints

def test_admins_can_use_the_search_admin_endpoints(client, db):
    make_user(db, "boss", role=UserRole.ADMIN)
    make_user(db, "learner")

    users = client.get("/api/search/users", params={"q": "student"}, headers=token_for(client, "boss"))

    assert users.status_code == 200
    # The role column is matched as text, so searching "student" finds the learner by role.
    assert [u["username"] for u in users.json()["items"]] == ["learner"]
    assert client.get("/api/search/users", params={"q": "x"},
                      headers=token_for(client, "learner")).status_code == 403


# --------------------------------------------------------------------------- study time

def test_watched_minutes_counts_forward_playback_capped_by_wall_clock():
    from services.analytics_service import _watched_minutes

    now = datetime.now(timezone.utc)
    assert _watched_minutes(30, 30, now - timedelta(seconds=10)) == 0           # paused
    assert _watched_minutes(50, 60, now - timedelta(seconds=10)) == 1           # crossed one minute
    assert _watched_minutes(100, 40, now - timedelta(seconds=10)) == 0          # sought backwards
    assert _watched_minutes(0, 1800, now - timedelta(seconds=10)) == 1          # skipped ahead 30 min in 10 s
    assert _watched_minutes(0, 300, now - timedelta(minutes=5)) == 5            # really watched 5 min
    assert _watched_minutes(0, 600, None) == 1                                  # first ping: at most one


def test_progress_pings_on_a_paused_video_add_no_study_time(db, course):
    from services.analytics_service import update_lecture_progress

    learner = make_user(db, "learner")
    module = Module(course_id=course.id, title="Module")
    db.add(module)
    db.flush()
    lecture = Lecture(module_id=module.id, title="Lecture", duration_seconds=600)
    db.add(lecture)
    db.commit()

    for _ in range(30):  # five minutes of 10-second pings while paused at 0:45
        update_lecture_progress(db, learner.id, lecture.id, 7.5, 45)

    minutes = sum(s.duration_minutes for s in db.query(StudySession).filter(StudySession.user_id == learner.id))
    assert minutes == 0
