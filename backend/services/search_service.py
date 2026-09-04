"""
Elasticsearch Search Service for Codexia Academy LMS.
Provides unified global search and dedicated scoped search engines for:
- Courses (catalog & paths)
- Coding Practice (problems, tags, difficulties)
- Quizzes & Assessments (topics, titles)
- Personal Notes (scoped to user)
- Discussions & Community Doubts
- Admin User Management

Features transparent PostgreSQL fallback resilience if Elasticsearch is offline or indexing.
"""

import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from utils.elasticsearch_client import (
    get_es_client, is_es_available, init_indices,
    INDEX_COURSES, INDEX_CODING, INDEX_QUIZZES,
    INDEX_NOTES, INDEX_DISCUSSIONS, INDEX_USERS
)
from models.course import Course
from models.coding import CodingProblem
from models.quiz import Quiz
from models.content import Note
from models.v3_models import Discussion, SearchHistory
from models.user import User, UserRole

logger = logging.getLogger("codexia.search_service")


# ==============================================================================
# Bulk Synchronization / Reindexing
# ==============================================================================

def sync_all_to_elasticsearch(db: Session) -> Dict[str, Any]:
    """
    Scans all database tables and indexes existing records into Elasticsearch.
    Safe to run on startup or on demand via /api/search/reindex.
    """
    if not is_es_available():
        logger.warning("Elasticsearch unavailable. Skipping sync.")
        return {"status": "skipped", "reason": "Elasticsearch unavailable"}

    init_indices()
    client = get_es_client()
    stats = {"courses": 0, "coding": 0, "quizzes": 0, "notes": 0, "discussions": 0, "users": 0}

    try:
        # 1. Sync Courses
        courses = db.query(Course).filter(Course.is_published == True).all()
        for c in courses:
            doc = {
                "id": c.id,
                "title": c.title,
                "slug": c.slug,
                "category": c.category or "programming",
                "difficulty": (c.difficulty or "beginner").lower(),
                "short_description": c.short_description or "",
                "description": c.description or "",
                "tags": c.tags or "",
                "price": float(c.price or 0.0),
                "instructor_name": c.instructor.full_name if c.instructor else "",
                "is_published": c.is_published,
                "is_approved": c.is_approved,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            client.index(index=INDEX_COURSES, id=str(c.id), document=doc)
            stats["courses"] += 1

        # 2. Sync Coding Problems
        problems = db.query(CodingProblem).filter(CodingProblem.is_published == True).all()
        for p in problems:
            diff_val = p.difficulty.value if hasattr(p.difficulty, "value") else str(p.difficulty)
            doc = {
                "id": p.id,
                "title": p.title,
                "slug": p.slug,
                "difficulty": diff_val.lower(),
                "tags": p.tags or "",
                "description": p.description or "",
                "category": getattr(p, "category", None) or "Algorithms",
                "is_published": p.is_published,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            client.index(index=INDEX_CODING, id=str(p.id), document=doc)
            stats["coding"] += 1

        # 3. Sync Quizzes
        quizzes = db.query(Quiz).all()
        for q in quizzes:
            course_title = q.course.title if q.course else ""
            doc = {
                "id": q.id,
                "title": q.title,
                "description": q.description or "",
                "topic": q.title.replace("AI Quiz:", "").strip(),
                "course_id": q.course_id,
                "course_title": course_title,
                "difficulty": "medium",
                "passing_percentage": int(q.passing_percentage or 70),
                "created_at": q.created_at.isoformat() if q.created_at else None,
            }
            client.index(index=INDEX_QUIZZES, id=str(q.id), document=doc)
            stats["quizzes"] += 1

        # 4. Sync Notes
        notes = db.query(Note).all()
        for n in notes:
            course_title = n.course.title if getattr(n, "course", None) else ""
            doc = {
                "id": n.id,
                "user_id": n.user_id,
                "course_id": n.course_id,
                "course_title": course_title,
                "title": n.title,
                "content": n.content or "",
                "is_bookmarked": n.is_bookmarked,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            client.index(index=INDEX_NOTES, id=str(n.id), document=doc)
            stats["notes"] += 1

        # 5. Sync Discussions
        discussions = db.query(Discussion).all()
        for d in discussions:
            doc = {
                "id": d.id,
                "user_id": d.user_id,
                "user_name": d.user.full_name if getattr(d, "user", None) else "Learner",
                "title": d.title,
                "content": d.content or "",
                "is_doubt": d.is_doubt,
                "category": "General",
                "course_id": d.course_id,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            client.index(index=INDEX_DISCUSSIONS, id=str(d.id), document=doc)
            stats["discussions"] += 1

        # 6. Sync Users
        users = db.query(User).all()
        for u in users:
            role_val = u.role.value if hasattr(u.role, "value") else str(u.role)
            doc = {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "username": u.username,
                "role": role_val,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            client.index(index=INDEX_USERS, id=str(u.id), document=doc)
            stats["users"] += 1


        logger.info(f"Elasticsearch synchronization completed: {stats}")
        return {"status": "success", "indexed": stats}

    except Exception as e:
        logger.error(f"Error during Elasticsearch sync: {e}")
        return {"status": "error", "error": str(e), "partial_stats": stats}


# ==============================================================================
# 1. Global Omnibox Search (Navbar Spotlight)
# ==============================================================================

def search_global(
    db: Session,
    q: str,
    limit: int = 15,
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    """
    Unified global search across Courses, Coding Problems, Quizzes, Notes, and Discussions.
    Uses Elasticsearch multi_match with fuzzy tolerance and falls back to PostgreSQL.
    """
    clean_q = q.strip()
    if not clean_q:
        return {"query": "", "courses": [], "problems": [], "quizzes": [], "notes": [], "discussions": [], "total_results": 0}

    # Log search query
    try:
        log = SearchHistory(user_id=current_user.id if current_user else None, query=clean_q)
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()

    courses = search_courses(db, clean_q, limit=5)
    problems = search_coding_problems(db, clean_q, limit=5)
    quizzes = search_quizzes(db, clean_q, limit=4)
    notes = search_notes(db, clean_q, user_id=current_user.id, limit=3) if current_user else []
    discussions = search_discussions(db, clean_q, limit=4)

    total = len(courses) + len(problems) + len(quizzes) + len(notes) + len(discussions)

    return {
        "query": clean_q,
        "courses": courses,
        "problems": problems,
        "quizzes": quizzes,
        "notes": notes,
        "discussions": discussions,
        "total_results": total
    }


# ==============================================================================
# 2. Courses Scoped Search
# ==============================================================================

def search_courses(
    db: Session,
    q: str,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Search courses by title, tags, description, instructor with ES or DB fallback."""
    clean_q = q.strip()

    if is_es_available() and clean_q:
        client = get_es_client()
        try:
            must_clauses = [
                {
                    "multi_match": {
                        "query": clean_q,
                        "fields": ["title^4", "tags^2", "short_description", "description", "instructor_name"],
                        "fuzziness": "AUTO",
                        "prefix_length": 2
                    }
                }
            ]
            filter_clauses = [{"term": {"is_published": True}}]
            if category:
                filter_clauses.append({"term": {"category": category}})
            if difficulty:
                filter_clauses.append({"term": {"difficulty": difficulty.lower()}})

            query_body = {
                "query": {
                    "bool": {
                        "must": must_clauses,
                        "filter": filter_clauses
                    }
                },
                "size": limit
            }

            res = client.search(index=INDEX_COURSES, body=query_body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [
                    {
                        "id": h["_source"]["id"],
                        "title": h["_source"]["title"],
                        "slug": h["_source"]["slug"],
                        "category": h["_source"]["category"],
                        "difficulty": h["_source"]["difficulty"],
                        "short_description": h["_source"]["short_description"],
                        "price": h["_source"].get("price", 0.0),
                        "instructor_name": h["_source"].get("instructor_name", ""),
                        "type": "course"
                    }
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"ES search_courses error: {e}. Falling back to DB.")

    # PostgreSQL Fallback
    query = db.query(Course).filter(Course.is_published == True)
    if clean_q:
        pattern = f"%{clean_q}%"
        query = query.filter(
            or_(
                Course.title.ilike(pattern),
                Course.description.ilike(pattern),
                Course.short_description.ilike(pattern),
                Course.tags.ilike(pattern)
            )
        )
    if category:
        query = query.filter(Course.category == category)
    if difficulty:
        query = query.filter(Course.difficulty == difficulty.upper())

    results = query.limit(limit).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "slug": c.slug,
            "category": c.category,
            "difficulty": c.difficulty,
            "short_description": c.short_description,
            "price": c.price,
            "instructor_name": c.instructor.full_name if c.instructor else "",
            "type": "course"
        }
        for c in results
    ]


# ==============================================================================
# 3. Coding Practice Scoped Search
# ==============================================================================

def search_coding_problems(
    db: Session,
    q: str,
    difficulty: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Search coding practice problems by title, tags, description."""
    clean_q = q.strip()

    if is_es_available() and clean_q:
        client = get_es_client()
        try:
            must_clauses = [
                {
                    "multi_match": {
                        "query": clean_q,
                        "fields": ["title^4", "tags^3", "description"],
                        "fuzziness": "AUTO"
                    }
                }
            ]
            filter_clauses = [{"term": {"is_published": True}}]
            if difficulty:
                filter_clauses.append({"term": {"difficulty": difficulty.lower()}})

            query_body = {
                "query": {
                    "bool": {
                        "must": must_clauses,
                        "filter": filter_clauses
                    }
                },
                "size": limit
            }

            res = client.search(index=INDEX_CODING, body=query_body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [
                    {
                        "id": h["_source"]["id"],
                        "title": h["_source"]["title"],
                        "slug": h["_source"]["slug"],
                        "difficulty": h["_source"]["difficulty"].upper(),
                        "tags": h["_source"]["tags"],
                        "category": h["_source"].get("category", "General"),
                        "type": "coding"
                    }
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"ES search_coding_problems error: {e}. Falling back to DB.")

    # PostgreSQL Fallback
    query = db.query(CodingProblem).filter(CodingProblem.is_published == True)
    if clean_q:
        pattern = f"%{clean_q}%"
        query = query.filter(
            or_(
                CodingProblem.title.ilike(pattern),
                CodingProblem.tags.ilike(pattern),
                CodingProblem.description.ilike(pattern)
            )
        )
    if difficulty:
        query = query.filter(CodingProblem.difficulty == difficulty.upper())

    results = query.limit(limit).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "difficulty": p.difficulty,
            "tags": p.tags,
            "category": p.category,
            "type": "coding"
        }
        for p in results
    ]


# ==============================================================================
# 4. Quiz Hub Scoped Search
# ==============================================================================

def search_quizzes(
    db: Session,
    q: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Search quizzes and assessments by title, description, or topic."""
    clean_q = q.strip()

    if is_es_available() and clean_q:
        client = get_es_client()
        try:
            query_body = {
                "query": {
                    "multi_match": {
                        "query": clean_q,
                        "fields": ["title^4", "topic^3", "description", "course_title^2"],
                        "fuzziness": "AUTO"
                    }
                },
                "size": limit
            }
            res = client.search(index=INDEX_QUIZZES, body=query_body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [
                    {
                        "id": h["_source"]["id"],
                        "title": h["_source"]["title"],
                        "description": h["_source"]["description"],
                        "topic": h["_source"].get("topic", ""),
                        "course_title": h["_source"].get("course_title", ""),
                        "passing_percentage": h["_source"].get("passing_percentage", 70),
                        "type": "quiz"
                    }
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"ES search_quizzes error: {e}. Falling back to DB.")

    # PostgreSQL Fallback
    query = db.query(Quiz)
    if clean_q:
        pattern = f"%{clean_q}%"
        query = query.filter(
            or_(
                Quiz.title.ilike(pattern),
                Quiz.description.ilike(pattern)
            )
        )
    results = query.limit(limit).all()
    return [
        {
            "id": qz.id,
            "title": qz.title,
            "description": qz.description,
            "topic": qz.title.replace("AI Quiz:", "").strip(),
            "course_title": qz.course.title if qz.course else "",
            "passing_percentage": qz.passing_percentage,
            "type": "quiz"
        }
        for qz in results
    ]


# ==============================================================================
# 5. Personal Notes Scoped Search
# ==============================================================================

def search_notes(
    db: Session,
    q: str,
    user_id: int,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Search student's private notes scoped strictly to their user_id."""
    clean_q = q.strip()

    if is_es_available() and clean_q:
        client = get_es_client()
        try:
            query_body = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": clean_q,
                                    "fields": ["title^3", "content", "course_title^2"],
                                    "fuzziness": "AUTO"
                                }
                            }
                        ],
                        "filter": [
                            {"term": {"user_id": user_id}}
                        ]
                    }
                },
                "size": limit
            }
            res = client.search(index=INDEX_NOTES, body=query_body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [
                    {
                        "id": h["_source"]["id"],
                        "title": h["_source"]["title"],
                        "content": h["_source"]["content"][:200] if h["_source"].get("content") else "",
                        "course_title": h["_source"].get("course_title", ""),
                        "is_bookmarked": h["_source"].get("is_bookmarked", False),
                        "type": "note"
                    }
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"ES search_notes error: {e}. Falling back to DB.")

    # PostgreSQL Fallback
    query = db.query(Note).filter(Note.user_id == user_id)
    if clean_q:
        pattern = f"%{clean_q}%"
        query = query.filter(
            or_(
                Note.title.ilike(pattern),
                Note.content.ilike(pattern)
            )
        )
    results = query.order_by(Note.updated_at.desc()).limit(limit).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content[:200] if n.content else "",
            "course_title": n.course.title if getattr(n, "course", None) else "",
            "is_bookmarked": n.is_bookmarked,
            "type": "note"
        }
        for n in results
    ]


# ==============================================================================
# 6. Discussions Scoped Search
# ==============================================================================

def search_discussions(
    db: Session,
    q: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Search community discussion threads and doubts."""
    clean_q = q.strip()

    if is_es_available() and clean_q:
        client = get_es_client()
        try:
            query_body = {
                "query": {
                    "multi_match": {
                        "query": clean_q,
                        "fields": ["title^3", "content", "user_name"],
                        "fuzziness": "AUTO"
                    }
                },
                "size": limit
            }
            res = client.search(index=INDEX_DISCUSSIONS, body=query_body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [
                    {
                        "id": h["_source"]["id"],
                        "title": h["_source"]["title"],
                        "content": h["_source"]["content"][:180] if h["_source"].get("content") else "",
                        "user_name": h["_source"].get("user_name", "Learner"),
                        "is_doubt": h["_source"].get("is_doubt", False),
                        "type": "discussion"
                    }
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"ES search_discussions error: {e}. Falling back to DB.")

    # PostgreSQL Fallback
    query = db.query(Discussion)
    if clean_q:
        pattern = f"%{clean_q}%"
        query = query.filter(
            or_(
                Discussion.title.ilike(pattern),
                Discussion.content.ilike(pattern)
            )
        )
    results = query.order_by(Discussion.created_at.desc()).limit(limit).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "content": d.content[:180] if d.content else "",
            "user_name": d.user.full_name if d.user else "Learner",
            "is_doubt": d.is_doubt,
            "type": "discussion"
        }
        for d in results
    ]


# ==============================================================================
# 7. Users Scoped Search (Admin Only)
# ==============================================================================

def search_users(
    db: Session,
    q: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Search users by name, username, email, or role."""
    clean_q = q.strip()

    if is_es_available() and clean_q:
        client = get_es_client()
        try:
            query_body = {
                "query": {
                    "multi_match": {
                        "query": clean_q,
                        "fields": ["full_name^3", "username^3", "email^2", "role"],
                        "fuzziness": "AUTO"
                    }
                },
                "size": limit
            }
            res = client.search(index=INDEX_USERS, body=query_body)
            hits = res.get("hits", {}).get("hits", [])
            if hits:
                return [
                    {
                        "id": h["_source"]["id"],
                        "full_name": h["_source"]["full_name"],
                        "email": h["_source"]["email"],
                        "username": h["_source"]["username"],
                        "role": h["_source"]["role"],
                        "is_active": h["_source"]["is_active"],
                        "type": "user"
                    }
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"ES search_users error: {e}. Falling back to DB.")

    # PostgreSQL Fallback
    query = db.query(User)
    if clean_q:
        pattern = f"%{clean_q}%"
        query = query.filter(
            or_(
                User.full_name.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.role.ilike(pattern)
            )
        )
    results = query.limit(limit).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "type": "user"
        }
        for u in results
    ]
