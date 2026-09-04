"""
Intelligent Platform Analytics routes v3.0
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role
from models.user import User, UserRole
from models.course import Course, Enrollment, Lecture
from models.quiz import QuizAttempt
from models.coding import Submission, CodingProblem
from models.analytics import StudySession
from utils.cache import cache_get, cache_set, cache_invalidate_prefix

router = APIRouter(prefix="/analytics", tags=["Analytics Platform"])


@router.get("/student")
def get_student_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch comprehensive student study progress statistics including activity heatmap logs.
    """
    cache_key = f"analytics:student:{current_user.id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # 1. Study hours from study sessions
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).all()
    total_mins = sum(s.duration_minutes for s in sessions)
    
    # 2. Heatmap contributions
    heatmap = {}
    for s in sessions:
        if s.date:
            date_str = s.date.strftime("%Y-%m-%d") if hasattr(s.date, "strftime") else str(s.date)[:10]
            heatmap[date_str] = heatmap.get(date_str, 0) + s.duration_minutes

    # 3. Quiz performance averages
    quiz_attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    avg_score = (
        round(sum(a.score for a in quiz_attempts) / len(quiz_attempts), 1)
        if quiz_attempts else 0.0
    )

    # 4. Coding submissions
    submissions = db.query(Submission).filter(Submission.user_id == current_user.id).all()
    solved_problems = len(set(s.problem_id for s in submissions if s.status == "accepted"))

    # 5. Course progress details
    enrollments = db.query(Enrollment).filter(Enrollment.user_id == current_user.id).all()
    progress_list = []
    course_cat_map = {}
    for e in enrollments:
        progress_list.append({
            "course_id": e.course_id,
            "title": e.course.title if e.course else "Unknown",
            "progress_percent": e.completion_percentage
        })
        if e.course and e.course.category:
            cat = e.course.category.lower()
            course_cat_map[cat] = max(course_cat_map.get(cat, 0), e.completion_percentage)

    # 6. Skill radar metrics dynamically calculated from true user progress and problem completions
    solved_tags = db.query(CodingProblem.tags)\
        .join(Submission, Submission.problem_id == CodingProblem.id)\
        .filter(Submission.user_id == current_user.id, Submission.status == "accepted").all()
        
    cat_map = {}
    for (tags_str,) in solved_tags:
        if tags_str:
            for tag in tags_str.split(","):
                t = tag.strip().lower()
                cat_map[t] = cat_map.get(t, 0) + 1

    # Total problems per topic domain in the database for true ratio calculation
    total_algo_problems = max(1, db.query(CodingProblem).filter(
        (CodingProblem.tags.ilike("%dynamic programming%")) | 
        (CodingProblem.tags.ilike("%binary search%")) | 
        (CodingProblem.tags.ilike("%recursion%")) | 
        (CodingProblem.tags.ilike("%divide and conquer%")) |
        (CodingProblem.tags.ilike("%greedy%"))
    ).count())

    total_ds_problems = max(1, db.query(CodingProblem).filter(
        (CodingProblem.tags.ilike("%array%")) | 
        (CodingProblem.tags.ilike("%string%")) | 
        (CodingProblem.tags.ilike("%hash table%")) | 
        (CodingProblem.tags.ilike("%stack%")) | 
        (CodingProblem.tags.ilike("%linked list%")) | 
        (CodingProblem.tags.ilike("%two pointers%"))
    ).count())

    algo_solved = (
        cat_map.get("dynamic programming", 0) + 
        cat_map.get("binary search", 0) + 
        cat_map.get("recursion", 0) + 
        cat_map.get("divide and conquer", 0) + 
        cat_map.get("greedy", 0)
    )
    ds_solved = (
        cat_map.get("array", 0) + 
        cat_map.get("string", 0) + 
        cat_map.get("hash table", 0) + 
        cat_map.get("stack", 0) + 
        cat_map.get("linked list", 0) + 
        cat_map.get("two pointers", 0)
    )

    # Calculate authentic percentages without artificial bonuses
    algo_course_pct = course_cat_map.get("algorithms", 0.0)
    algo_prob_pct = min(100.0, (algo_solved / total_algo_problems) * 100.0)
    algorithms_score = max(algo_course_pct, algo_prob_pct) if (algo_course_pct > 0 or algo_prob_pct > 0) else 0.0

    ds_course_pct = max(course_cat_map.get("data structures", 0.0), course_cat_map.get("data-structures", 0.0))
    ds_prob_pct = min(100.0, (ds_solved / total_ds_problems) * 100.0)
    ds_score = max(ds_course_pct, ds_prob_pct) if (ds_course_pct > 0 or ds_prob_pct > 0) else 0.0

    sys_design_score = max(course_cat_map.get("system-design", 0.0), course_cat_map.get("system design", 0.0))

    db_course_pct = max(course_cat_map.get("database", 0.0), course_cat_map.get("databases", 0.0))
    db_prob_pct = min(100.0, (cat_map.get("database", 0) / max(1, db.query(CodingProblem).filter(CodingProblem.tags.ilike("%database%")).count())) * 100.0)
    database_score = max(db_course_pct, db_prob_pct) if (db_course_pct > 0 or db_prob_pct > 0) else 0.0

    web_dev_score = max(
        course_cat_map.get("web-development", 0.0),
        course_cat_map.get("web development", 0.0),
        course_cat_map.get("frontend", 0.0),
        course_cat_map.get("backend", 0.0)
    )

    skills = [
        {"subject": "Algorithms", "A": int(round(algorithms_score)), "fullMark": 100},
        {"subject": "Data Structures", "A": int(round(ds_score)), "fullMark": 100},
        {"subject": "System Design", "A": int(round(sys_design_score)), "fullMark": 100},
        {"subject": "Database", "A": int(round(database_score)), "fullMark": 100},
        {"subject": "Web Development", "A": int(round(web_dev_score)), "fullMark": 100}
    ]

    from models.certificate import Certificate
    from services.analytics_service import _calculate_streak
    certs_count = db.query(Certificate).filter(Certificate.user_id == current_user.id).count()
    real_streak = _calculate_streak(db, current_user.id)

    result = {
        "study_hours": round(total_mins / 60.0, 1),
        "streak_days": real_streak,
        "heatmap": heatmap,
        "quizzes_taken": len(quiz_attempts),
        "avg_quiz_score": avg_score,
        "problems_solved": solved_problems,
        "certificates_earned": certs_count,
        "course_progress": progress_list,
        "skills_radar": skills
    }
    cache_set(cache_key, result, ttl=60)
    return result


@router.get("/instructor")
def get_instructor_analytics(
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db)
):
    """
    Fetch course performance statistics for instructor dashboard.
    """
    cache_key = f"analytics:instructor:{current_user.id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    courses = db.query(Course).filter(Course.instructor_id == current_user.id).all()
    course_ids = [c.id for c in courses]

    if course_ids:
        instructor_enrollments = db.query(Enrollment).filter(Enrollment.course_id.in_(course_ids)).all()
        total_enrollments = len(instructor_enrollments)
        
        if total_enrollments > 0:
            avg_completion = sum(e.completion_percentage for e in instructor_enrollments) / total_enrollments
            course_completion_rate = round(avg_completion, 1)
            lecture_watch_rate = round(avg_completion, 1)
        else:
            course_completion_rate = 0.0
            lecture_watch_rate = 0.0
    else:
        total_enrollments = 0
        course_completion_rate = 0.0
        lecture_watch_rate = 0.0

    # Average quiz attempts performance inside instructor's courses
    from models.quiz import Quiz
    attempts = (
        db.query(QuizAttempt)
        .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
        .filter(Quiz.course_id.in_(course_ids))
        .all()
    ) if course_ids else []
    
    avg_score = (
        round(sum(a.score for a in attempts) / len(attempts), 1)
        if attempts else 0.0
    )

    return {
        "active_students": total_enrollments,
        "course_completion_rate": course_completion_rate,
        "average_quiz_score": avg_score,
        "lecture_watch_rate": lecture_watch_rate,
        "courses_list": [
            {
                "id": c.id,
                "title": c.title,
                "enrollment_count": db.query(Enrollment).filter(Enrollment.course_id == c.id).count()
            } for c in courses
        ]
    }
    cache_set(cache_key, result, ttl=180)
    return result


@router.get("/admin")
def get_admin_analytics(
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db)
):
    """
    Fetch system-wide performance and traffic metrics.
    """
    cache_key = "analytics:admin:overview"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    total_users = db.query(User).count()
    student_count = db.query(User).filter(User.role == "student").count()
    instructor_count = db.query(User).filter(User.role == "instructor").count()
    total_courses = db.query(Course).count()

    # Registrations in the last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_users = db.query(User).filter(User.created_at >= thirty_days_ago).count()

    # Popular categories
    popular_categories = db.query(
        Course.category, func.count(Course.id)
    ).group_by(Course.category).all()

    return {
        "total_users": total_users,
        "students": student_count,
        "instructors": instructor_count,
        "total_courses": total_courses,
        "registrations_last_30_days": new_users,
        "categories_distribution": [
            {"category": row[0], "count": row[1]} for row in popular_categories
        ]
    }
    cache_set(cache_key, result, ttl=180)
    return result
