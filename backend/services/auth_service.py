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

    from models.session import Session as UserSession
    # Strict Single-Device enforcement: invalidate all previous active sessions
    db.query(UserSession).filter(
        UserSession.user_id == authenticated_user.id,
        UserSession.is_active == True
    ).update({"is_active": False})

    # Increment token_version so any previously issued access/refresh tokens are immediately rejected
    authenticated_user.token_version = (authenticated_user.token_version or 0) + 1
    authenticated_user.last_login = datetime.now(timezone.utc)

    access_token = create_access_token(data={
        "sub": str(authenticated_user.id),
        "role": authenticated_user.role.value,
        "ver": authenticated_user.token_version,
    })
    refresh_token = create_refresh_token(data={
        "sub": str(authenticated_user.id),
        "ver": authenticated_user.token_version,
    })

    # Store refresh token / session mapping on database
    create_user_session(db, authenticated_user.id, refresh_token, ip_address, user_agent, expires_in_days=7 if remember_me else 1)
    record_login_attempt(db, email, "success", ip_address, user_agent)

    # Store refresh token hash on user (backward compatibility)
    authenticated_user.refresh_token = refresh_token
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": authenticated_user,
    }


def signup_user(db: Session, user_data: UserCreate) -> User:
    """Register a new user and create initial OTP."""
    user = create_user(db, user_data)
    return user


def verify_account_otp(db: Session, email: str, otp: str) -> dict:
    """Verify 6-digit OTP for user account activation within 60 seconds."""
    from datetime import datetime, timezone
    from models.session import Session as UserSession
    email_clean = email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise ValueError("No account found with this email address.")

    if user.is_verified:
        # Already verified, return login tokens with single-device enforcement
        db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.is_active == True).update({"is_active": False})
        user.token_version = (user.token_version or 0) + 1
        db.commit()

        access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value, "ver": user.token_version})
        refresh_token = create_refresh_token(data={"sub": str(user.id), "ver": user.token_version})
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer", "user": user}

    if user.verification_otp_expires:
        expires = user.verification_otp_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            user.verification_otp = None
            user.verification_otp_expires = None
            db.commit()
            raise ValueError("Verification OTP code has expired (60s limit). Please click 'Resend OTP' for a new code.")

    if not user.verification_otp or user.verification_otp.strip() != otp.strip():
        raise ValueError("Invalid verification OTP code. Please check your email inbox for the 6-digit OTP code.")

    # Verification successful
    user.is_verified = True
    user.verification_otp = None
    user.verification_otp_expires = None
    user.token_version = (user.token_version or 0) + 1
    db.commit()

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value, "ver": user.token_version})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "ver": user.token_version})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


def resend_account_otp(db: Session, email: str) -> str:
    """Generate a new 6-digit OTP expiring in 60s for the given email."""
    import secrets
    from datetime import datetime, timezone, timedelta
    email_clean = email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise ValueError("No account found with this email address.")

    if user.is_verified:
        raise ValueError("This account is already verified. Please log in directly.")

    new_otp = f"{secrets.randbelow(1000000):06d}"
    user.verification_otp = new_otp
    user.verification_otp_expires = datetime.now(timezone.utc) + timedelta(seconds=60)
    user.last_verification_sent_at = datetime.now(timezone.utc)
    db.commit()
    return new_otp


def refresh_access_token(
    db: Session,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """
    Validate a refresh token, rotate it, and issue a new access token.
    Raises ValueError if the refresh token is invalid or superseded by another device.
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

    # Strict single-device session check on refresh
    token_ver = payload.get("ver")
    if token_ver is not None and user.token_version is not None:
        if token_ver != user.token_version:
            raise ValueError("Session expired: Your account was logged in from another device.")

    # Rotate token session (RTR)
    new_refresh_token = create_refresh_token(data={"sub": str(user.id), "ver": user.token_version})
    validate_and_rotate_session(db, refresh_token, new_refresh_token, ip_address, user_agent)

    # For backward compatibility
    user.refresh_token = new_refresh_token
    db.commit()

    new_access_token = create_access_token(data={
        "sub": str(user.id),
        "role": user.role.value,
        "ver": user.token_version,
    })
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


def logout_user(db: Session, user: User, refresh_token: Optional[str] = None) -> bool:
    """Invalidate the active device session and bump token_version."""
    from services.session_service import revoke_user_session
    from models.session import Session as UserSession
    if refresh_token:
        revoke_user_session(db, refresh_token)
    db.query(UserSession).filter(UserSession.user_id == user.id).update({"is_active": False})
    user.token_version = (user.token_version or 0) + 1
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
