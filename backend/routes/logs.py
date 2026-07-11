"""
Super Admin audit and security log review endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role
from models.user import User, UserRole
from models.audit import AuditLog, SecurityLog

router = APIRouter()


@router.get("/audit")
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Retrieve system audit logs (Super Admin only)."""
    query = db.query(AuditLog)
    if search:
        query = query.filter(
            (AuditLog.action.contains(search)) |
            (AuditLog.target_type.contains(search)) |
            (AuditLog.ip_address.contains(search))
        )
    total = query.count()
    items = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "username": log.user.username if log.user else "System",
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "previous_value": log.previous_value,
                "new_value": log.new_value,
                "ip_address": log.ip_address,
                "browser": log.browser,
                "created_at": log.created_at,
            }
            for log in items
        ]
    }


@router.get("/security")
def list_security_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Retrieve login and security events (Super Admin only)."""
    query = db.query(SecurityLog)
    if search:
        query = query.filter(
            (SecurityLog.event_type.contains(search)) |
            (SecurityLog.details.contains(search)) |
            (SecurityLog.ip_address.contains(search))
        )
    total = query.count()
    items = query.order_by(SecurityLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "username": log.user.username if log.user else "Anonymous",
                "event_type": log.event_type,
                "details": log.details,
                "ip_address": log.ip_address,
                "browser": log.browser,
                "created_at": log.created_at,
            }
            for log in items
        ]
    }
