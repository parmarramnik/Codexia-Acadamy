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
from utils.cache import cache_get, cache_set, cache_invalidate_prefix

router = APIRouter()


@router.get("", response_model=list)
def list_all_quizzes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all published quizzes with course titles and question counts."""
    cache_key = f"quizzes:list:{current_user.id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    from models.quiz import Quiz, Question, QuizAttempt
    quizzes = db.query(Quiz).all()
    res = []
    for q in quizzes:
        question_count = db.query(Question).filter(Question.quiz_id == q.id).count()
        attempts = db.query(QuizAttempt).filter(
            QuizAttempt.quiz_id == q.id,
            QuizAttempt.user_id == current_user.id
        ).order_by(QuizAttempt.score.desc()).all()
        
        best_score = attempts[0].percentage if attempts else None
        
        res.append({
            "id": q.id,
            "course_id": q.course_id,
            "course_title": q.course.title if q.course else "General Assessment",
            "title": q.title,
            "description": q.description,
            "time_limit_minutes": q.time_limit_minutes,
            "total_marks": q.total_marks,
            "passing_percentage": q.passing_percentage,
            "question_count": question_count,
            "user_best_percentage": best_score,
            "user_attempts_count": len(attempts),
            "max_attempts": q.max_attempts
        })
    cache_set(cache_key, res, ttl=300)
    return res


@router.get("/{quiz_id}")
def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a quiz with its questions (answers without correct flag)."""
    cache_key = f"quizzes:detail:{quiz_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

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
    cache_set(cache_key, payload, ttl=600)
    return payload


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
    from services.analytics_service import log_study_activity, create_notification
    log_study_activity(db, current_user.id, duration_delta_minutes=10, completed_quiz=True)
    try:
        quiz = quiz_service.get_quiz_by_id(db, quiz_id)
        quiz_title = quiz.title if quiz else "Quiz Assessment"
        score_val = attempt.score if hasattr(attempt, 'score') else 100
        create_notification(
            db=db,
            user_id=current_user.id,
            title=f"Quiz Completed: {quiz_title}",
            message=f"You scored {score_val:.0f}% on '{quiz_title}'. Keep up the momentum!",
            notification_type="quiz_result",
            link="/quizzes",
        )
    except Exception:
        pass
    
    # Invalidate student quiz and analytics caches
    cache_invalidate_prefix(f"quizzes:list:{current_user.id}")
    cache_invalidate_prefix(f"analytics:dashboard:{current_user.id}")
    cache_invalidate_prefix(f"analytics:student:{current_user.id}")

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


from pydantic import BaseModel, Field
from typing import Optional, List
from ai.generator import generate_quiz_questions
from models.quiz import Quiz, Question, Answer, QuizAttempt, QuizResponse as QuizRespModel


class AIQuizRequest(BaseModel):
    topic: str = Field(..., description="Subject or topic for quiz generation")
    course_id: Optional[int] = None
    question_count: int = Field(5, ge=1, le=20)
    difficulty: str = Field("medium", description="easy, medium, hard")
    time_limit_minutes: int = Field(15, ge=1)
    passing_percentage: int = Field(70, ge=1, le=100)


@router.post("", response_model=dict)
def create_quiz_manual(
    data: QuizCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually create a new quiz with questions and answers (Instructor/Admin only)."""
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in ("instructor", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only instructors and admins can create quizzes")

    quiz = quiz_service.create_quiz(db, data.course_id, data)
    quiz.is_published = True
    db.commit()
    db.refresh(quiz)
    cache_invalidate_prefix("quizzes:")
    return {"message": "Quiz created successfully", "quiz_id": quiz.id}


@router.post("/ai-generate", response_model=dict)
def create_quiz_ai(
    data: AIQuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a full quiz with AI based on topic/course name and question count (Instructor/Admin only)."""
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in ("instructor", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only instructors and admins can generate quizzes")

    # Generate questions using Gemini AI
    generated_q_list = generate_quiz_questions(
        topic=data.topic,
        count=data.question_count,
        difficulty=data.difficulty
    )

    if not generated_q_list or "error" in generated_q_list[0]:
        raise HTTPException(status_code=500, detail="AI quiz generation failed. Please try again.")

    target_course_id = data.course_id
    if not target_course_id:
        from models.course import Course
        first_c = db.query(Course.id).first()
        if first_c:
            target_course_id = first_c[0]

    total_marks = len(generated_q_list) * 10
    quiz = Quiz(
        course_id=target_course_id,
        title=f"AI Quiz: {data.topic}",
        description=f"Generated assessment on '{data.topic}' ({data.difficulty.capitalize()} level).",
        time_limit_minutes=data.time_limit_minutes,
        total_marks=total_marks,
        passing_percentage=data.passing_percentage,
        is_published=True,
        max_attempts=3
    )
    db.add(quiz)
    db.flush()

    for idx, g_q in enumerate(generated_q_list, start=1):
        q_obj = Question(
            quiz_id=quiz.id,
            question_type="mcq",
            content=g_q.get("question", f"Question {idx} on {data.topic}"),
            explanation=g_q.get("explanation", "Review core concept details."),
            marks=10,
            order_index=idx
        )
        db.add(q_obj)
        db.flush()

        options = g_q.get("options", ["Option A", "Option B", "Option C", "Option D"])
        correct_ans = g_q.get("correct_answer", options[0])

        for a_idx, opt_text in enumerate(options, start=1):
            is_corr = str(opt_text).strip().lower() == str(correct_ans).strip().lower() or a_idx == 1
            answer = Answer(
                question_id=q_obj.id,
                content=opt_text,
                is_correct=is_corr,
                order_index=a_idx
            )
            db.add(answer)

    db.commit()
    db.refresh(quiz)
    cache_invalidate_prefix("quizzes:")
    return {"message": f"AI Quiz generated successfully with {len(generated_q_list)} questions", "quiz_id": quiz.id}


@router.put("/{quiz_id}", response_model=MessageResponse)
def update_quiz(
    quiz_id: int,
    data: QuizUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update quiz settings."""
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in ("instructor", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(quiz, field, value)
    db.commit()
    cache_invalidate_prefix("quizzes:")
    return {"message": "Quiz updated successfully"}


@router.delete("/{quiz_id}", response_model=MessageResponse)
def delete_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a quiz (Instructor/Admin/Super Admin only)."""
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role not in ("instructor", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only instructors and admins can delete quizzes")

    quiz = quiz_service.get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Clean up associated questions, answers, and attempts first
    questions = db.query(Question).filter(Question.quiz_id == quiz_id).all()
    for q in questions:
        db.query(Answer).filter(Answer.question_id == q.id).delete(synchronize_session=False)
    db.query(Question).filter(Question.quiz_id == quiz_id).delete(synchronize_session=False)
    db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).delete(synchronize_session=False)

    db.delete(quiz)
    db.commit()
    cache_invalidate_prefix("quizzes:")
    return {"message": "Quiz deleted successfully"}
