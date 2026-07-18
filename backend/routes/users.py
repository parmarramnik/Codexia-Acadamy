"""
User management routes — profile, list users, update role.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role
from models.user import User, UserRole
from schemas.user import (
    UserResponse, UserListResponse, UserUpdate,
    ChangePassword, MessageResponse,
)
from services import user_service
from services.audit_service import log_audit_event

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return current_user


@router.get("/leaderboard/top")
def get_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the leaderboard of top users based on accepted submissions."""
    from models.coding import Submission, SubmissionStatus
    from sqlalchemy.sql import func
    
    # Query top users
    top_solvers = (
        db.query(User.id, User.username, User.full_name, func.count(func.distinct(Submission.problem_id)).label("solved_count"))
        .outerjoin(Submission, (Submission.user_id == User.id) & (Submission.status == SubmissionStatus.ACCEPTED))
        .filter(User.role == UserRole.STUDENT)
        .group_by(User.id)
        .order_by(func.count(func.distinct(Submission.problem_id)).desc(), User.username.asc())
        .limit(limit)
        .all()
    )
    
    return [
        {
            "rank": idx + 1,
            "user_id": user[0],
            "username": user[1],
            "full_name": user[2],
            "solved_count": user[3],
        }
        for idx, user in enumerate(top_solvers)
    ]


@router.put("/me", response_model=UserResponse)
def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile."""
    return user_service.update_user_profile(db, current_user, data)


@router.post("/me/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    user_service.change_user_password(db, current_user, data.current_password, data.new_password)
    return {"message": "Password changed successfully"}


@router.get("", response_model=dict)
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """List all users with filtering (admin only)."""
    result = user_service.list_users(db, page, page_size, role, search, is_active)
    return {
        **result.to_dict(),
        "items": [UserListResponse.model_validate(u) for u in result.items],
    }


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Get a specific user by ID (admin only)."""
    user = user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role: str,
    request: Request,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Change a user's role (super admin only)."""
    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    
    target_user = user_service.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    prev_role = target_user.role.value
    updated_user = user_service.update_user_role(db, user_id, new_role)
    
    log_audit_event(
        db, current_user.id, "role_change", "user", str(user_id),
        previous_value=prev_role, new_value=role, request=request
    )
    return updated_user


@router.patch("/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_status(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Activate or deactivate a user (admin only)."""
    target_user = user_service.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    prev_status = str(target_user.is_active)
    updated_user = user_service.toggle_user_active(db, user_id)
    
    log_audit_event(
        db, current_user.id, "toggle_active", "user", str(user_id),
        previous_value=prev_status, new_value=str(updated_user.is_active), request=request
    )
    return updated_user


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Delete a user account (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    target_user = user_service.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_service.delete_user(db, user_id)
    
    log_audit_event(
        db, current_user.id, "delete_user", "user", str(user_id),
        previous_value=target_user.username, new_value=None, request=request
    )
    return {"message": "User deleted successfully"}


@router.patch("/{user_id}/reset-password", response_model=MessageResponse)
def admin_reset_password(
    user_id: int,
    request: Request,
    new_password: str = Query(..., min_length=6),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Reset a user's password (admin only)."""
    target_user = user_service.get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    from auth.password import hash_password
    target_user.password_hash = hash_password(new_password)
    db.commit()
    
    log_audit_event(
        db, current_user.id, "admin_reset_password", "user", str(user_id),
        previous_value="Password reset by admin", new_value=None, request=request
    )
    return {"message": "User password reset successfully"}
