"""
Audit logging service to record security and modification events.
"""

from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session

from models.audit import AuditLog, SecurityLog


def get_request_metadata(request: Optional[Request]) -> tuple[Optional[str], Optional[str]]:
    """Helper to extract IP Address and Browser headers from Request."""
    if not request:
        return None, None
    ip = request.client.host if request.client else None
    browser = request.headers.get("user-agent")
    return ip, browser


def log_security_event(
    db: Session,
    user_id: Optional[int],
    event_type: str,
    details: Optional[str] = None,
    request: Optional[Request] = None,
) -> SecurityLog:
    """Log an authentication or security-related event."""
    ip, browser = get_request_metadata(request)
    log_entry = SecurityLog(
        user_id=user_id,
        event_type=event_type,
        details=details,
        ip_address=ip,
        browser=browser,
    )
    db.add(log_entry)
    db.commit()
    return log_entry


def log_audit_event(
    db: Session,
    user_id: Optional[int],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log a transactional modification event (audit trail)."""
    ip, browser = get_request_metadata(request)
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        previous_value=previous_value,
        new_value=new_value,
        ip_address=ip,
        browser=browser,
    )
    db.add(log_entry)
    db.commit()
    return log_entry
