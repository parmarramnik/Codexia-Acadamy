"""
Role-based access control decorators and dependencies.
Use these to restrict endpoints to specific user roles.
"""

from functools import wraps
from typing import List

from fastapi import Depends, HTTPException, status

from auth.oauth2 import get_current_user
from models.user import User, UserRole


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory: restrict endpoint to users with specific roles.
    Super Admin always has access.

    Usage:
        @router.get("/admin/users")
        def list_users(user: User = Depends(require_role(UserRole.ADMIN))):
            ...
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(r.value for r in allowed_roles)}",
            )
        return current_user
    return role_checker


def require_any_role(*allowed_roles: UserRole):
    """Alias for require_role — accepts any of the listed roles."""
    return require_role(*allowed_roles)


def is_owner_or_admin(resource_user_id: int, current_user: User) -> bool:
    """Check if the current user owns a resource or is an admin."""
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return True
    return current_user.id == resource_user_id
