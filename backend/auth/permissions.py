"""
Role-based access control decorators and dependencies.
Use these to restrict endpoints to specific user roles.
"""

from functools import wraps
from typing import List

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.oauth2 import get_current_user
from models.user import User, UserRole
from database import get_db


def require_permission(permission_name: str):
    """
    Dependency factory: restrict endpoint to users whose role possesses the specified permission.
    Super Admin always has access.
    """
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user

        from models.user import Role, Permission, RolePermission
        
        # Validate permission mapping dynamically via database
        has_perm = (
            db.query(RolePermission)
            .join(Role)
            .join(Permission)
            .filter(
                Role.name == current_user.role.value,
                Permission.name == permission_name
            )
            .first()
        )

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Missing permission: '{permission_name}'",
            )
        return current_user
    return permission_checker


def require_role(*allowed_roles):
    """
    Dependency factory: restrict endpoint to users with specific roles.
    Super Admin always has access.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        if user_role_val == "super_admin":
            return current_user
        
        allowed_str_list = [r.value if hasattr(r, 'value') else str(r) for r in allowed_roles]
        if user_role_val not in allowed_str_list:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_str_list)}",
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
