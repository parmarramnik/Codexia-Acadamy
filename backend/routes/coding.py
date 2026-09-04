import json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user, get_current_user_optional
from auth.permissions import require_role
from models.user import User, UserRole
from models.coding import Submission, SubmissionStatus, CodingProblem
from models.v4_models import SystemSetting
from schemas.coding import (
    CodingProblemCreate, CodingProblemResponse, CodingProblemListResponse,
    CodeRunRequest, CodeSubmitRequest, SubmissionResponse,
    TestCaseResponse,
)
from schemas.user import MessageResponse
from services import coding_service
from utils.cache import cache_get, cache_set, cache_invalidate_prefix

router = APIRouter()


from pydantic import BaseModel

class CustomRunRequest(BaseModel):
    code: str
    language: str
    custom_input: str = ""

class DailyChallengeSetRequest(BaseModel):
    problem_id: int
    date: Optional[str] = None

@router.get("/problems", response_model=dict)
def list_problems(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    course_id: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """List coding problems with filtering and user solved status."""
    solved_set = set()
    if current_user:
        accepted_subs = (
            db.query(Submission.problem_id)
            .filter(
                Submission.user_id == current_user.id,
                Submission.status == SubmissionStatus.ACCEPTED
            )
            .all()
        )
        solved_set = {s[0] for s in accepted_subs}

    cache_key = f"coding:problems:{page}:{page_size}:{difficulty or 'all'}:{search or 'all'}:{course_id or 'all'}"
    cached_payload = cache_get(cache_key)
    if cached_payload is not None:
        items = []
        for it in cached_payload.get("items", []):
            item_copy = dict(it)
            item_copy["is_solved"] = (item_copy.get("id") in solved_set)
            items.append(item_copy)
        return {**cached_payload, "items": items}

    result = coding_service.list_problems(db, page, page_size, difficulty, search, course_id)
    items = []
    for p in result.items:
        item = CodingProblemListResponse.model_validate(p).model_dump()
        item["acceptance_rate"] = (
            round(p.accepted_submissions / p.total_submissions * 100, 1)
            if p.total_submissions > 0 else 0
        )
        item["is_solved"] = (p.id in solved_set)
        items.append(item)
    payload = {**result.to_dict(), "items": items}
    cache_set(cache_key, payload, ttl=300)
    return payload


@router.get("/daily-challenge")
def get_daily_challenge(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Get today's daily coding challenge if assigned by instructor or admin."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    setting = db.query(SystemSetting).filter(SystemSetting.key == "daily_challenge").first()
    
    if not setting or not setting.value:
        return {
            "available": False,
            "date": today_str,
            "problem": None,
            "is_solved": False,
            "message": "Not available today"
        }
        
    try:
        data = json.loads(setting.value)
        if data.get("date") != today_str:
            return {
                "available": False,
                "date": today_str,
                "problem": None,
                "is_solved": False,
                "message": "Not available today"
            }
            
        prob_id = data.get("problem_id")
        problem = db.query(CodingProblem).filter(CodingProblem.id == prob_id).first()
        if not problem or not problem.is_published:
            return {
                "available": False,
                "date": today_str,
                "problem": None,
                "is_solved": False,
                "message": "Not available today"
            }
            
        is_solved = False
        if current_user:
            accepted = db.query(Submission).filter(
                Submission.problem_id == problem.id,
                Submission.user_id == current_user.id,
                Submission.status == SubmissionStatus.ACCEPTED
            ).first()
            is_solved = bool(accepted)
            
        return {
            "available": True,
            "date": today_str,
            "problem": {
                "id": problem.id,
                "title": problem.title,
                "slug": problem.slug,
                "difficulty": problem.difficulty.value if hasattr(problem.difficulty, "value") else str(problem.difficulty),
                "tags": problem.tags
            },
            "is_solved": is_solved,
            "assigned_by": data.get("set_by_name", "Instructor")
        }
    except Exception:
        return {
            "available": False,
            "date": today_str,
            "problem": None,
            "is_solved": False,
            "message": "Not available today"
        }


@router.post("/daily-challenge")
def set_daily_challenge(
    data: DailyChallengeSetRequest,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Set today's daily coding challenge (instructor or admin only)."""
    problem = db.query(CodingProblem).filter(CodingProblem.id == data.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    challenge_date = data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    val = json.dumps({
        "problem_id": problem.id,
        "date": challenge_date,
        "set_by": current_user.id,
        "set_by_name": current_user.full_name or current_user.username
    })
    
    setting = db.query(SystemSetting).filter(SystemSetting.key == "daily_challenge").first()
    if not setting:
        setting = SystemSetting(key="daily_challenge", value=val, description="Current daily coding challenge")
        db.add(setting)
    else:
        setting.value = val
        setting.updated_at = datetime.now(timezone.utc)
        
    db.commit()
    cache_invalidate_prefix("coding")
    return {
        "status": "success",
        "message": f"Daily challenge set to '{problem.title}' for {challenge_date}",
        "problem": {
            "id": problem.id,
            "title": problem.title,
            "slug": problem.slug,
            "difficulty": problem.difficulty.value if hasattr(problem.difficulty, "value") else str(problem.difficulty)
        },
        "date": challenge_date
    }


@router.get("/problems/favorites")
def get_favorite_problems(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get favorite problem IDs for the current user."""
    # Returns the list of favorites (mockable or from user session/meta)
    return []


@router.post("/problems/{problem_id}/favorite")
def toggle_favorite_problem(
    problem_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a problem as favorite."""
    return {"status": "added", "favorited": True, "problem_id": problem_id}


@router.post("/problems/{problem_id}/custom-run")
def run_custom_code(
    problem_id: int,
    data: CustomRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run code against custom standard input."""
    return coding_service.custom_run_code(db, problem_id, data.code, data.language, data.custom_input)


@router.get("/problems/random")
def get_random_problem(db: Session = Depends(get_db)):
    """Return a random problem slug for the Pick One feature."""
    slug = coding_service.get_random_problem_slug(db)
    if not slug:
        raise HTTPException(status_code=404, detail="No problems available")
    return {"slug": slug}


@router.get("/problems/{slug_or_id}")
def get_problem(
    slug_or_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Get a coding problem by slug or ID."""
    if slug_or_id.isdigit():
        problem = coding_service.get_problem_by_id(db, int(slug_or_id))
    else:
        problem = coding_service.get_problem_by_slug(db, slug_or_id)

    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    response = CodingProblemResponse.model_validate(problem).model_dump()
    response["acceptance_rate"] = (
        round(problem.accepted_submissions / problem.total_submissions * 100, 1)
        if problem.total_submissions > 0 else 0
    )
    # Include non-hidden test cases
    response["test_cases"] = [
        TestCaseResponse.model_validate(tc).model_dump()
        for tc in problem.test_cases if not tc.is_hidden
    ]
    # Check if current user has solved this problem
    is_solved = False
    if current_user:
        accepted = db.query(Submission).filter(
            Submission.problem_id == problem.id,
            Submission.user_id == current_user.id,
            Submission.status == SubmissionStatus.ACCEPTED
        ).first()
        is_solved = bool(accepted)
    response["is_solved"] = is_solved
    return response


@router.post("/problems", response_model=CodingProblemResponse)
def create_problem(
    data: CodingProblemCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Create a coding problem (instructor, admin, or super admin)."""
    prob = coding_service.create_problem(db, data)

    if getattr(data, "set_as_daily", False):
        try:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            val = json.dumps({
                "problem_id": prob.id,
                "date": today_str,
                "set_by": current_user.id,
                "set_by_name": current_user.full_name or current_user.username
            })
            setting = db.query(SystemSetting).filter(SystemSetting.key == "daily_challenge").first()
            if not setting:
                setting = SystemSetting(key="daily_challenge", value=val, description="Current daily coding challenge")
                db.add(setting)
            else:
                setting.value = val
                setting.updated_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()

    cache_invalidate_prefix("coding")
    cache_invalidate_prefix("v3_coding")
    return prob


@router.post("/problems/{problem_id}/run")
def run_code(
    problem_id: int,
    data: CodeRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run code against sample test cases."""
    return coding_service.run_code(db, problem_id, data.code, data.language)


@router.post("/problems/{problem_id}/submit", response_model=SubmissionResponse)
def submit_code(
    problem_id: int,
    data: CodeSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit code for full evaluation."""
    submission = coding_service.submit_code(db, problem_id, current_user.id, data.code, data.language)
    
    # Check if submission is accepted to credit the student
    from models.coding import SubmissionStatus
    is_accepted = (submission.status == SubmissionStatus.ACCEPTED)
    
    from services.analytics_service import log_study_activity, create_notification
    log_study_activity(db, current_user.id, duration_delta_minutes=15, solved_problem=is_accepted)
    
    if is_accepted:
        try:
            problem = coding_service.get_problem_by_id(db, problem_id)
            problem_title = problem.title if problem else "Coding Challenge"
            create_notification(
                db=db,
                user_id=current_user.id,
                title=f"Problem Solved: {problem_title}",
                message=f"All test cases passed for '{problem_title}'! Well done.",
                notification_type="achievement",
                link=f"/coding/{problem.slug if problem else ''}",
            )
        except Exception:
            pass

    # Invalidate caching immediately so session statistics and lists update in real time
    cache_invalidate_prefix("coding")
    cache_invalidate_prefix("v3_coding")
    cache_invalidate_prefix("analytics")
            
    return submission


@router.get("/problems/{problem_id}/submissions")
def get_submissions(
    problem_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's submissions for a problem."""
    submissions = coding_service.get_user_submissions(db, problem_id, current_user.id)
    return [SubmissionResponse.model_validate(s) for s in submissions]
