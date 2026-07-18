"""
Session service — manages multi-device sessions, login history, and lockouts.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session as DBSession

from models.session import Session, LoginHistory
from models.user import User


def create_user_session(
    db: DBSession,
    user_id: int,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    expires_in_days: int = 7,
) -> Session:
    """Creates a new active session for a logged-in user (multi-device support)."""
    # Deactivate any duplicate token sessions just in case
    db.query(Session).filter(
        Session.user_id == user_id, 
        Session.session_token == refresh_token
    ).update({"is_active": False})

    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    
    session = Session(
        user_id=user_id,
        session_token=refresh_token,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def validate_and_rotate_session(
    db: DBSession,
    old_refresh_token: str,
    new_refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Session:
    """
    Validates a session by its refresh token and rotates it (RTR).
    If token reuse is detected, all active sessions for the user are revoked.
    """
    # Find session matching the token
    session = db.query(Session).filter(Session.session_token == old_refresh_token).first()
    
    # Token reuse detection
    if session and not session.is_active:
        # Invalidate all user sessions immediately for security compromise
        db.query(Session).filter(Session.user_id == session.user_id).update({"is_active": False})
        db.commit()
        raise ValueError("Suspicious token reuse detected. Invalided all device sessions.")

    if not session or session.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc) or not session.is_active:
        raise ValueError("Invalid, expired, or inactive session")

    # Rotate the session token (RTR)
    session.session_token = new_refresh_token
    session.last_active_at = datetime.now(timezone.utc)
    # Reset expiration extension
    session.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    if ip_address:
        session.ip_address = ip_address
    if user_agent:
        session.user_agent = user_agent

    db.commit()
    db.refresh(session)
    return session


def revoke_user_session(db: DBSession, refresh_token: str) -> bool:
    """Deactivates a single session by its refresh token (logout from one device)."""
    session = db.query(Session).filter(Session.session_token == refresh_token).first()
    if session:
        session.is_active = False
        db.commit()
        return True
    return False


def revoke_specific_session_by_id(db: DBSession, user_id: int, session_id: int) -> bool:
    """Deactivates a specific session by its primary ID (settings device revocation)."""
    session = db.query(Session).filter(Session.id == session_id, Session.user_id == user_id).first()
    if session:
        session.is_active = False
        db.commit()
        return True
    return False


def revoke_all_user_sessions(db: DBSession, user_id: int) -> bool:
    """Deactivates all active sessions for a user (logout from all devices)."""
    db.query(Session).filter(Session.user_id == user_id, Session.is_active == True).update({"is_active": False})
    # Also invalidate refresh token in user profile
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.refresh_token = None
    db.commit()
    return True


def get_active_sessions(db: DBSession, user_id: int) -> List[Session]:
    """Retrieves all active, non-expired sessions for a user."""
    now = datetime.now(timezone.utc)
    return (
        db.query(Session)
        .filter(
            Session.user_id == user_id,
            Session.is_active == True,
            Session.expires_at > now,
        )
        .all()
    )


def record_login_attempt(
    db: DBSession,
    email: str,
    status: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    failure_reason: Optional[str] = None,
) -> LoginHistory:
    """Logs login history event and evaluates lockouts on consecutive failures."""
    # Find user
    user = db.query(User).filter(User.email == email).first()
    user_id = user.id if user else None

    # Track locked out or password history status
    log_entry = LoginHistory(
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        failure_reason=failure_reason,
    )
    db.add(log_entry)

    if user:
        if status == "success":
            # Reset counters
            user.failed_login_attempts = 0
            user.lockout_until = None
        else:
            # Increment failed attempts
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                # Lockout for 15 minutes
                user.lockout_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                log_entry.status = "locked_out"
                log_entry.failure_reason = "Account locked due to 5 consecutive login failures"
                
    db.commit()
    return log_entry
