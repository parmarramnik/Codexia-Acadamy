"""
Quiz service — business logic for quiz management, attempts, and leaderboards.
"""

from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import random

from models.quiz import Quiz, Question, Answer, QuizAttempt, QuizResponse
from models.user import User
from schemas.quiz import QuizCreate, QuizAttemptSubmit


def create_quiz(db: Session, course_id: int, data: QuizCreate) -> Quiz:
    """Create a quiz with questions and answers."""
    total_marks = sum(q.marks for q in data.questions)

    quiz = Quiz(
        course_id=course_id,
        title=data.title,
        description=data.description,
        time_limit_minutes=data.time_limit_minutes,
        total_marks=total_marks,
        passing_percentage=data.passing_percentage,
        negative_marking=data.negative_marking,
        is_randomized=data.is_randomized,
        max_attempts=data.max_attempts,
        is_published=False,
    )
    db.add(quiz)
    db.flush()

    for q_data in data.questions:
        question = Question(
            quiz_id=quiz.id,
            question_type=q_data.question_type,
            content=q_data.content,
            explanation=q_data.explanation,
            marks=q_data.marks,
            order_index=q_data.order_index,
            code_snippet=q_data.code_snippet,
        )
        db.add(question)
        db.flush()

        for a_data in q_data.answers:
            answer = Answer(
                question_id=question.id,
                content=a_data.content,
                is_correct=a_data.is_correct,
                order_index=a_data.order_index,
            )
            db.add(answer)

    db.commit()
    db.refresh(quiz)
    return quiz


def get_quiz_by_id(db: Session, quiz_id: int) -> Optional[Quiz]:
    """Fetch a quiz with its questions and answers."""
    return (
        db.query(Quiz)
        .options(
            joinedload(Quiz.questions).joinedload(Question.answers)
        )
        .filter(Quiz.id == quiz_id)
        .first()
    )


def get_quiz_questions(db: Session, quiz_id: int, randomize: bool = False) -> List[Question]:
    """Get questions for a quiz, optionally randomized."""
    questions = (
        db.query(Question)
        .options(joinedload(Question.answers))
        .filter(Question.quiz_id == quiz_id)
        .order_by(Question.order_index)
        .all()
    )
    if randomize:
        random.shuffle(questions)
    return questions


def submit_quiz_attempt(
    db: Session,
    quiz_id: int,
    user_id: int,
    data: QuizAttemptSubmit,
) -> QuizAttempt:
    """Score and save a quiz attempt."""
    quiz = get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise ValueError("Quiz not found")

    # Check attempt count
    attempt_count = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
        .count()
    )
    if attempt_count >= quiz.max_attempts:
        raise ValueError(f"Maximum attempts ({quiz.max_attempts}) reached")

    # Create attempt
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=user_id,
        time_taken_seconds=data.time_taken_seconds,
        started_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.flush()

    # Score each response
    total_score = 0.0
    for response_data in data.responses:
        question = db.query(Question).filter(Question.id == response_data.question_id).first()
        if not question:
            continue

        correct_answer_ids = {
            a.id for a in question.answers if a.is_correct
        }
        selected_ids = set(response_data.selected_answer_ids)
        is_correct = selected_ids == correct_answer_ids and len(selected_ids) > 0

        marks_awarded = 0.0
        if is_correct:
            marks_awarded = question.marks
            total_score += marks_awarded
        elif selected_ids and quiz.negative_marking > 0:
            marks_awarded = -quiz.negative_marking
            total_score += marks_awarded

        quiz_response = QuizResponse(
            attempt_id=attempt.id,
            question_id=response_data.question_id,
            selected_answer_ids=",".join(str(i) for i in response_data.selected_answer_ids),
            text_answer=response_data.text_answer,
            is_correct=is_correct,
            marks_awarded=marks_awarded,
        )
        db.add(quiz_response)

    # Finalize attempt
    attempt.score = max(0, total_score)
    attempt.total_marks = quiz.total_marks
    attempt.percentage = (attempt.score / quiz.total_marks * 100) if quiz.total_marks > 0 else 0
    attempt.is_passed = attempt.percentage >= quiz.passing_percentage
    attempt.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(attempt)
    return attempt


def get_quiz_leaderboard(db: Session, quiz_id: int, limit: int = 20) -> List[dict]:
    """Get the top scores for a quiz."""
    results = (
        db.query(
            QuizAttempt.user_id,
            User.username,
            User.full_name,
            func.max(QuizAttempt.score).label("best_score"),
            func.max(QuizAttempt.percentage).label("best_percentage"),
            func.min(QuizAttempt.time_taken_seconds).label("best_time"),
        )
        .join(User, QuizAttempt.user_id == User.id)
        .filter(QuizAttempt.quiz_id == quiz_id)
        .group_by(QuizAttempt.user_id, User.username, User.full_name)
        .order_by(func.max(QuizAttempt.percentage).desc(), func.min(QuizAttempt.time_taken_seconds).asc())
        .limit(limit)
        .all()
    )

    leaderboard = []
    for rank, row in enumerate(results, 1):
        leaderboard.append({
            "rank": rank,
            "user_id": row.user_id,
            "username": row.username,
            "full_name": row.full_name,
            "score": float(row.best_score),
            "percentage": float(row.best_percentage),
            "time_taken_seconds": row.best_time,
        })
    return leaderboard


def get_user_attempts(db: Session, quiz_id: int, user_id: int) -> List[QuizAttempt]:
    """Get all attempts by a user for a specific quiz."""
    return (
        db.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.started_at.desc())
        .all()
    )
