"""
Coding practice routes — problems, run code, submit solution.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user, get_current_user_optional
from auth.permissions import require_role
from models.user import User, UserRole
from schemas.coding import (
    CodingProblemCreate, CodingProblemResponse, CodingProblemListResponse,
    CodeRunRequest, CodeSubmitRequest, SubmissionResponse,
    TestCaseResponse,
)
from schemas.user import MessageResponse
from services import coding_service

router = APIRouter()


@router.get("/problems", response_model=dict)
def list_problems(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """List coding problems with filtering."""
    result = coding_service.list_problems(db, page, page_size, difficulty, search, course_id)
    items = []
    for p in result.items:
        item = CodingProblemListResponse.model_validate(p).model_dump()
        item["acceptance_rate"] = (
            round(p.accepted_submissions / p.total_submissions * 100, 1)
            if p.total_submissions > 0 else 0
        )
        items.append(item)
    return {**result.to_dict(), "items": items}


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
    return response


@router.post("/problems", response_model=CodingProblemResponse)
def create_problem(
    data: CodingProblemCreate,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Create a coding problem (instructor or admin)."""
    return coding_service.create_problem(db, data)


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
    
    from services.analytics_service import log_study_activity
    log_study_activity(db, current_user.id, duration_delta_minutes=15, solved_problem=is_accepted)
    
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
