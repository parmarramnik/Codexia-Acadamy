"""
Unified Search Engine routes v3.0 powered by Elasticsearch.
Provides dedicated domain-scoped endpoints and omnibox global search.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user, get_current_user_optional
from auth.permissions import require_role
from models.user import User, UserRole
from models.v3_models import SearchHistory
from services import search_service
from utils.elasticsearch_client import is_es_available

router = APIRouter(prefix="/search", tags=["Search Engine"])


# ==============================================================================
# Health & Status
# ==============================================================================

@router.get("/health")
def search_health():
    """Returns Elasticsearch cluster health and search engine status."""
    es_ok = is_es_available()
    return {
        "status": "healthy",
        "engine": "Elasticsearch" if es_ok else "PostgreSQL (Resilience Fallback)",
        "elasticsearch_connected": es_ok
    }


# ==============================================================================
# Bulk Reindex (Admin Only)
# ==============================================================================

@router.post("/reindex")
def reindex_all(
    current_user: User = Depends(require_role([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Triggers a full reindexing of all database records into Elasticsearch."""
    res = search_service.sync_all_to_elasticsearch(db)
    return res


# ==============================================================================
# 1. Global Omnibox Spotlight Search
# ==============================================================================

@router.get("/global")
def global_search(
    q: str = Query("", description="Search query string"),
    limit: int = Query(15, ge=1, le=50),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Unified global search over courses, coding problems, quizzes, notes, and discussions.
    """
    return search_service.search_global(db, q=q, limit=limit, current_user=current_user)


# ==============================================================================
# 2. Courses Dedicated Search
# ==============================================================================

@router.get("/courses")
def search_courses_endpoint(
    q: str = Query("", description="Course search query"),
    category: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Dedicated search for the Courses catalog."""
    results = search_service.search_courses(db, q=q, category=category, difficulty=difficulty, limit=limit)
    return {"query": q, "items": results, "total": len(results)}


# ==============================================================================
# 3. Coding Problems Dedicated Search
# ==============================================================================

@router.get("/coding")
def search_coding_endpoint(
    q: str = Query("", description="Coding problem search query"),
    difficulty: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Dedicated search for Coding Practice challenges."""
    results = search_service.search_coding_problems(db, q=q, difficulty=difficulty, limit=limit)
    return {"query": q, "items": results, "total": len(results)}


# ==============================================================================
# 4. Quizzes Dedicated Search
# ==============================================================================

@router.get("/quizzes")
def search_quizzes_endpoint(
    q: str = Query("", description="Quiz search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Dedicated search for Quiz Assessments."""
    results = search_service.search_quizzes(db, q=q, limit=limit)
    return {"query": q, "items": results, "total": len(results)}


# ==============================================================================
# 5. Personal Notes Dedicated Search
# ==============================================================================

@router.get("/notes")
def search_notes_endpoint(
    q: str = Query("", description="Notes search query"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dedicated search for authenticated student's private notes."""
    results = search_service.search_notes(db, q=q, user_id=current_user.id, limit=limit)
    return {"query": q, "items": results, "total": len(results)}


# ==============================================================================
# 6. Discussions Dedicated Search
# ==============================================================================

@router.get("/discussions")
def search_discussions_endpoint(
    q: str = Query("", description="Discussion query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Dedicated search for community forum threads and doubts."""
    results = search_service.search_discussions(db, q=q, limit=limit)
    return {"query": q, "items": results, "total": len(results)}


# ==============================================================================
# 7. Users Dedicated Search (Admin Only)
# ==============================================================================

@router.get("/users")
def search_users_endpoint(
    q: str = Query("", description="User search query"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value])),
    db: Session = Depends(get_db),
):
    """Dedicated user search for Admin portal."""
    results = search_service.search_users(db, q=q, limit=limit)
    return {"query": q, "items": results, "total": len(results)}


# ==============================================================================
# Suggestions & Popular Searches
# ==============================================================================

@router.get("/suggestions")
def get_suggestions(q: str = Query("", min_length=1), db: Session = Depends(get_db)):
    """Returns quick suggestions based on multi-match titles."""
    courses = search_service.search_courses(db, q=q, limit=4)
    problems = search_service.search_coding_problems(db, q=q, limit=4)
    suggestions = [c["title"] for c in courses] + [p["title"] for p in problems]
    return {"suggestions": list(dict.fromkeys(suggestions))}


@router.get("/popular")
def get_popular_searches(db: Session = Depends(get_db)):
    """Returns top popular search queries."""
    from sqlalchemy import func
    popular = db.query(
        SearchHistory.query, func.count(SearchHistory.id).label("cnt")
    ).group_by(SearchHistory.query).order_by(func.count(SearchHistory.id).desc()).limit(5).all()
    
    return {
        "queries": [p[0] for p in popular] if popular else ["React", "Python", "Algorithms", "FastAPI", "Docker"]
    }
