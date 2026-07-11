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
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


def login_user(db: Session, email: str, password: str, remember_me: bool = False) -> dict:
    """
    Authenticate and generate access + refresh tokens.
    Raises ValueError on failure.
    """
    user = authenticate_user(db, email, password)
    if not user:
        raise ValueError("Invalid email or password")

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Store refresh token hash on user
    user.refresh_token = refresh_token
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


def signup_user(db: Session, user_data: UserCreate) -> User:
    """Register a new user."""
    return create_user(db, user_data)


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    """
    Validate a refresh token and issue a new access token.
    Raises ValueError if the refresh token is invalid.
    """
    payload = verify_token(refresh_token, token_type="refresh")
    if not payload:
        raise ValueError("Invalid or expired refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid refresh token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise ValueError("User not found or inactive")

    if user.refresh_token != refresh_token:
        raise ValueError("Refresh token has been revoked")

    new_access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {"access_token": new_access_token, "token_type": "bearer"}


def logout_user(db: Session, user: User) -> bool:
    """Invalidate the user's refresh token."""
    user.refresh_token = None
    db.commit()
    return True


def request_password_reset(db: Session, email: str) -> Optional[str]:
    """
    Generate a password reset token.
    Returns the token if user exists, None otherwise (don't reveal if user exists).
    """
    user = get_user_by_email(db, email)
    if not user:
        return None  # Don't reveal existence

    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    return reset_token


def reset_password(db: Session, token: str, new_password: str) -> bool:
    """Reset password using a valid reset token."""
    user = (
        db.query(User)
        .filter(
            User.reset_token == token,
            User.reset_token_expires > datetime.now(timezone.utc),
        )
        .first()
    )
    if not user:
        raise ValueError("Invalid or expired reset token")

    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.refresh_token = None  # Invalidate sessions
    db.commit()
    return True
