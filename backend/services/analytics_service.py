"""
Analytics service — dashboard stats, study sessions, progress tracking.
"""

from typing import Optional, List
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.analytics import Progress, StudySession, Notification, ChatHistory
from models.course import Enrollment, Course
from models.quiz import QuizAttempt
from models.coding import Submission, SubmissionStatus
from models.certificate import Certificate


def get_dashboard_analytics(db: Session, user_id: int) -> dict:
    """Get overall learning analytics for a student."""
    total_enrolled = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.is_active == True)
        .count()
    )
    completed_courses = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user_id,
            Enrollment.completion_percentage >= 100,
        )
        .count()
    )
    total_study_minutes = (
        db.query(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .filter(StudySession.user_id == user_id)
        .scalar()
    )
    quizzes_taken = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == user_id)
        .count()
    )
    avg_quiz_score = (
        db.query(func.coalesce(func.avg(QuizAttempt.percentage), 0))
        .filter(QuizAttempt.user_id == user_id)
        .scalar()
    )
    problems_solved = (
        db.query(Submission)
        .filter(
            Submission.user_id == user_id,
            Submission.status == SubmissionStatus.ACCEPTED,
        )
        .distinct(Submission.problem_id)
        .count()
    )
    certificates_earned = (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id)
        .count()
    )

    # Calculate current streak
    streak = _calculate_streak(db, user_id)

    return {
        "total_courses_enrolled": total_enrolled,
        "completed_courses": completed_courses,
        "total_study_hours": round(total_study_minutes / 60, 1),
        "quizzes_taken": quizzes_taken,
        "average_quiz_score": round(float(avg_quiz_score), 1),
        "problems_solved": problems_solved,
        "current_streak": streak,
        "certificates_earned": certificates_earned,
    }


def _calculate_streak(db: Session, user_id: int) -> int:
    """Calculate the current consecutive-day study streak."""
    today = datetime.now(timezone.utc).date()
    streak = 0
    check_date = today

    while True:
        session = (
            db.query(StudySession)
            .filter(
                StudySession.user_id == user_id,
                func.date(StudySession.date) == check_date,
            )
            .first()
        )
        if session:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    return streak


def get_study_sessions(
    db: Session, user_id: int, days: int = 30
) -> List[StudySession]:
    """Get study sessions for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        db.query(StudySession)
        .filter(StudySession.user_id == user_id, StudySession.date >= since)
        .order_by(StudySession.date.desc())
        .all()
    )


def update_lecture_progress(
    db: Session,
    user_id: int,
    lecture_id: int,
    watch_percentage: float,
    last_position_seconds: int,
) -> Progress:
    """Update or create watch progress for a lecture."""
    progress = (
        db.query(Progress)
        .filter(Progress.user_id == user_id, Progress.lecture_id == lecture_id)
        .first()
    )

    if not progress:
        progress = Progress(
            user_id=user_id,
            lecture_id=lecture_id,
            watch_percentage=watch_percentage,
            last_position_seconds=last_position_seconds,
        )
        db.add(progress)
    else:
        progress.watch_percentage = max(progress.watch_percentage, watch_percentage)
        progress.last_position_seconds = last_position_seconds

    watched_completed = False
    if watch_percentage >= 90 and not progress.is_completed:
        progress.is_completed = True
        progress.completed_at = datetime.now(timezone.utc)
        watched_completed = True

    db.commit()
    db.refresh(progress)

    # Update enrollment completion percentage
    _update_enrollment_completion(db, user_id, lecture_id)

    # Record study session
    log_study_activity(db, user_id, duration_delta_minutes=2, watched_lecture=watched_completed)

    return progress


def _update_enrollment_completion(db: Session, user_id: int, lecture_id: int) -> None:
    """Recalculate course completion percentage after progress update."""
    from models.course import Lecture, Module

    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        return

    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    if not module:
        return

    course_id = module.course_id
    total_lectures = (
        db.query(Lecture)
        .join(Module)
        .filter(Module.course_id == course_id)
        .count()
    )
    completed_lectures = (
        db.query(Progress)
        .join(Lecture)
        .join(Module)
        .filter(
            Module.course_id == course_id,
            Progress.user_id == user_id,
            Progress.is_completed == True,
        )
        .count()
    )

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        .first()
    )
    if enrollment and total_lectures > 0:
        enrollment.completion_percentage = round(
            (completed_lectures / total_lectures) * 100, 2
        )
        if enrollment.completion_percentage >= 100:
            enrollment.completed_at = datetime.now(timezone.utc)
        db.commit()


def get_user_notifications(db: Session, user_id: int, unread_only: bool = False) -> List[Notification]:
    """Get notifications for a user."""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return query.order_by(Notification.created_at.desc()).limit(50).all()


def mark_notification_read(db: Session, notification_id: int, user_id: int) -> bool:
    """Mark a notification as read."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if notification:
        notification.is_read = True
        db.commit()
        return True
    return False


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None,
) -> Notification:
    """Create a notification for a user."""
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def log_study_activity(
    db: Session,
    user_id: int,
    duration_delta_minutes: int = 5,
    watched_lecture: bool = False,
    completed_quiz: bool = False,
    solved_problem: bool = False,
):
    """Log or update user study session progress for today."""
    from sqlalchemy import func
    
    today = datetime.now(timezone.utc).date()
    
    # Query for today's session (ignoring time)
    session = (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            func.date(StudySession.date) == today
        )
        .first()
    )
    
    if not session:
        session = StudySession(
            user_id=user_id,
            date=datetime.now(timezone.utc),
            duration_minutes=duration_delta_minutes,
            lectures_watched=1 if watched_lecture else 0,
            quizzes_completed=1 if completed_quiz else 0,
            problems_solved=1 if solved_problem else 0,
        )
        db.add(session)
    else:
        session.duration_minutes += duration_delta_minutes
        if watched_lecture:
            session.lectures_watched += 1
        if completed_quiz:
            session.quizzes_completed += 1
        if solved_problem:
            session.problems_solved += 1
            
    db.commit()
