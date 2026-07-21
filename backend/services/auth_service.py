"""
Auth service — handles signup, login, token refresh, and password reset logic.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from models.user import User, UserRole
from auth.jwt_handler import create_access_token, create_refresh_token, verify_token
from auth.password import hash_password, verify_password
from services.user_service import get_user_by_email, get_user_by_username, create_user
from schemas.user import UserCreate


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Validate a user's credentials and return the user if valid."""
    user = get_user_by_email(db, email) or get_user_by_username(db, email)
    if not user:
        return None
        
    # Lockout check
    if user.lockout_until:
        lockout_time = user.lockout_until.replace(tzinfo=timezone.utc)
        if lockout_time > datetime.now(timezone.utc):
            remaining = int((lockout_time - datetime.now(timezone.utc)).total_seconds() / 60)
            raise ValueError(f"Account locked out. Try again in {max(1, remaining)} minutes.")

    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


def login_user(
    db: Session,
    email: str,
    password: str,
    remember_me: bool = False,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Authenticate and generate access + refresh tokens.
    Raises ValueError on failure.
    """
    from services.session_service import create_user_session, record_login_attempt

    # Pre-check lockout logic
    user = get_user_by_email(db, email) or get_user_by_username(db, email)
    if user and user.lockout_until:
        lockout_time = user.lockout_until.replace(tzinfo=timezone.utc)
        if lockout_time > datetime.now(timezone.utc):
            remaining = int((lockout_time - datetime.now(timezone.utc)).total_seconds() / 60)
            record_login_attempt(db, email, "failed", ip_address, user_agent, "Attempt blocked: Account locked out")
            raise ValueError(f"Account locked out. Try again in {max(1, remaining)} minutes.")

    authenticated_user = authenticate_user(db, email, password)
    if not authenticated_user:
        record_login_attempt(db, email, "failed", ip_address, user_agent, "Invalid credentials")
        raise ValueError("Invalid email or password")

    access_token = create_access_token(data={"sub": str(authenticated_user.id), "role": authenticated_user.role.value})
    refresh_token = create_refresh_token(data={"sub": str(authenticated_user.id)})

    # Store refresh token / session mapping on database
    create_user_session(db, authenticated_user.id, refresh_token, ip_address, user_agent, expires_in_days=7 if remember_me else 1)
    record_login_attempt(db, email, "success", ip_address, user_agent)

    # Store refresh token hash on user (backward compatibility)
    authenticated_user.refresh_token = refresh_token
    authenticated_user.last_login = datetime.now(timezone.utc)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": authenticated_user,
    }


def signup_user(db: Session, user_data: UserCreate) -> User:
    """Register a new user and trigger verification email."""
    user = create_user(db, user_data)
    from utils.email_service import send_verification_email
    send_verification_email(user.email, user.verification_token)
    return user


def refresh_access_token(
    db: Session,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Validate a refresh token, rotate it, and issue a new access token.
    Raises ValueError if the refresh token is invalid.
    """
    from services.session_service import validate_and_rotate_session

    payload = verify_token(refresh_token, token_type="refresh")
    if not payload:
        raise ValueError("Invalid or expired refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid refresh token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise ValueError("User not found or inactive")

    # Rotate token session (RTR)
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    validate_and_rotate_session(db, refresh_token, new_refresh_token, ip_address, user_agent)

    # For backward compatibility
    user.refresh_token = new_refresh_token
    db.commit()

    new_access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


def logout_user(db: Session, user: User, refresh_token: Optional[str] = None) -> bool:
    """Invalidate the specific active session or all sessions."""
    from services.session_service import revoke_user_session
    if refresh_token:
        revoke_user_session(db, refresh_token)
    user.refresh_token = None
    db.commit()
    return True


def request_password_reset(db: Session, email: str) -> Optional[str]:
    """
    Generate a 6-digit password reset OTP and trigger email.
    """
    user = get_user_by_email(db, email)
    if not user:
        return None  # Don't reveal existence

    import random
    otp = f"{random.randint(100000, 999999)}"
    user.reset_token = otp
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()

    from utils.email_service import send_otp_reset_email
    send_otp_reset_email(user.email, otp)
    return otp


def reset_password(db: Session, email: str, otp: str, new_password: str) -> bool:
    """Reset password using email and 6-digit OTP code."""
    user = (
        db.query(User)
        .filter(
            User.email == email,
            User.reset_token == otp,
            User.reset_token_expires > datetime.now(timezone.utc),
        )
        .first()
    )
    if not user:
        raise ValueError("Invalid or expired reset code")

    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.refresh_token = None  # Invalidate sessions
    db.commit()
    return True
