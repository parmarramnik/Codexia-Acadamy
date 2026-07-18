"""
Unified Search Engine routes v3.0
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth.oauth2 import get_current_user_optional
from models.user import User, UserRole
from models.course import Course, Lecture
from models.coding import CodingProblem
from models.v3_models import SearchHistory

router = APIRouter(prefix="/search", tags=["Search Engine"])


@router.get("/global")
def global_search(
    q: str = Query("", description="Search query string"),
    category: Optional[str] = Query(None, description="Filter by course category"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    tag: Optional[str] = Query(None, description="Filter by tags"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Unified global search over courses, coding problems, lectures, and instructors.
    Logs searches into SearchHistory.
    """
    # Log search
    if q.strip():
        history_log = SearchHistory(
            user_id=current_user.id if current_user else None,
            query=q.strip()
        )
        db.add(history_log)
        db.commit()

    search_pattern = f"%{q}%"
    
    # 1. Search Courses
    course_query = db.query(Course)
    if q.strip():
        course_query = course_query.filter(
            or_(
                Course.title.ilike(search_pattern),
                Course.description.ilike(search_pattern),
                Course.short_description.ilike(search_pattern)
            )
        )
    if category:
        course_query = course_query.filter(Course.category == category)
    if difficulty:
        course_query = course_query.filter(Course.difficulty == difficulty.upper())
    
    courses = course_query.limit(page_size).all()
    courses_res = []
    for c in courses:
        courses_res.append({
            "id": c.id,
            "title": c.title,
            "slug": c.slug,
            "category": c.category,
            "difficulty": c.difficulty,
            "short_description": c.short_description,
            "type": "course"
        })

    # 2. Search Coding Problems
    problem_query = db.query(CodingProblem).filter(CodingProblem.is_published == True)
    if q.strip():
        problem_query = problem_query.filter(
            or_(
                CodingProblem.title.ilike(search_pattern),
                CodingProblem.tags.ilike(search_pattern)
            )
        )
    if difficulty:
        problem_query = problem_query.filter(CodingProblem.difficulty == difficulty.upper())
    if tag:
        problem_query = problem_query.filter(CodingProblem.tags.ilike(f"%{tag}%"))

    problems = problem_query.limit(page_size).all()
    problems_res = []
    for p in problems:
        problems_res.append({
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "difficulty": p.difficulty,
            "tags": p.tags,
            "type": "coding"
        })

    # 3. Search Instructors
    instructor_query = db.query(User).filter(User.role == UserRole.INSTRUCTOR.value)
    if q.strip():
        instructor_query = instructor_query.filter(
            or_(
                User.full_name.ilike(search_pattern),
                User.username.ilike(search_pattern)
            )
        )
    instructors = instructor_query.limit(page_size).all()
    instructors_res = []
    for i in instructors:
        instructors_res.append({
            "id": i.id,
            "full_name": i.full_name,
            "avatar_url": i.avatar_url,
            "bio": i.bio,
            "type": "instructor"
        })

    return {
        "query": q,
        "courses": courses_res,
        "problems": problems_res,
        "instructors": instructors_res,
        "total_results": len(courses_res) + len(problems_res) + len(instructors_res)
    }


@router.get("/suggestions")
def get_suggestions(q: str = Query("", min_length=1), db: Session = Depends(get_db)):
    """Returns search suggestions based on title matches."""
    pattern = f"%{q}%"
    course_titles = [row[0] for row in db.query(Course.title).filter(Course.title.ilike(pattern)).limit(5).all()]
    problem_titles = [row[0] for row in db.query(CodingProblem.title).filter(CodingProblem.title.ilike(pattern)).limit(5).all()]
    return {
        "suggestions": list(set(course_titles + problem_titles))
    }


@router.get("/popular")
def get_popular_searches(db: Session = Depends(get_db)):
    """Returns top 5 popular search queries compiled from history logs."""
    from sqlalchemy import func
    popular = db.query(
        SearchHistory.query, func.count(SearchHistory.id).label("cnt")
    ).group_by(SearchHistory.query).order_by(func.count(SearchHistory.id).desc()).limit(5).all()
    
    return {
        "queries": [p[0] for p in popular] if popular else ["React", "Python", "Data Structures", "SQL", "Javascript"]
    }
