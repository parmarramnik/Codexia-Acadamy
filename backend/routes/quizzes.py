"""
Quiz routes — CRUD, attempt submission, leaderboard.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role, is_owner_or_admin
from models.user import User, UserRole
from schemas.quiz import (
    QuizCreate, QuizUpdate, QuizResponse as QuizSchemaResponse,
    QuizAttemptSubmit, QuizAttemptResult, LeaderboardEntry,
    QuestionResponse,
)
from schemas.user import MessageResponse
from services import quiz_service, course_service

router = APIRouter()


@router.get("/{quiz_id}")
def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a quiz with its questions (answers without correct flag)."""
    quiz = quiz_service.get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = quiz_service.get_quiz_questions(db, quiz_id, randomize=quiz.is_randomized)
    question_list = []
    for q in questions:
        q_dict = QuestionResponse.model_validate(q).model_dump()
        question_list.append(q_dict)

    return {
        "id": quiz.id,
        "course_id": quiz.course_id,
        "title": quiz.title,
        "description": quiz.description,
        "time_limit_minutes": quiz.time_limit_minutes,
        "total_marks": quiz.total_marks,
        "passing_percentage": quiz.passing_percentage,
        "negative_marking": quiz.negative_marking,
        "max_attempts": quiz.max_attempts,
        "question_count": len(questions),
        "questions": question_list,
    }


@router.post("/{quiz_id}/attempt", response_model=QuizAttemptResult)
def submit_attempt(
    quiz_id: int,
    data: QuizAttemptSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a quiz attempt for scoring."""
    attempt = quiz_service.submit_quiz_attempt(db, quiz_id, current_user.id, data)
    
    # Log study time and completed quiz status
    from services.analytics_service import log_study_activity
    log_study_activity(db, current_user.id, duration_delta_minutes=10, completed_quiz=True)
    
    return attempt


@router.get("/{quiz_id}/leaderboard")
def get_leaderboard(
    quiz_id: int,
    db: Session = Depends(get_db),
):
    """Get the quiz leaderboard."""
    quiz = quiz_service.get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz_service.get_quiz_leaderboard(db, quiz_id)


@router.get("/{quiz_id}/attempts")
def get_my_attempts(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all attempts by the current user for a quiz."""
    attempts = quiz_service.get_user_attempts(db, quiz_id, current_user.id)
    return [QuizAttemptResult.model_validate(a) for a in attempts]


@router.put("/{quiz_id}", response_model=MessageResponse)
def update_quiz(
    quiz_id: int,
    data: QuizUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update quiz settings."""
    quiz = quiz_service.get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    course = course_service.get_course_by_id(db, quiz.course_id)
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(quiz, field, value)
    db.commit()
    return {"message": "Quiz updated successfully"}


@router.delete("/{quiz_id}", response_model=MessageResponse)
def delete_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a quiz."""
    quiz = quiz_service.get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    course = course_service.get_course_by_id(db, quiz.course_id)
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted successfully"}
