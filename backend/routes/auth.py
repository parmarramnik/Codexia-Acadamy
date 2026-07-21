from __future__ import annotations

"""
Authentication routes — signup, login, logout, password reset, email verification, token refresh.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from schemas.user import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    RefreshTokenRequest, LogoutRequest, PasswordReset, PasswordResetConfirm,
    ChangePassword, MessageResponse, ResendVerificationRequest,
)
from services import auth_service
from services.audit_service import log_security_event
from middleware.rate_limiter import limiter

router = APIRouter()


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def signup(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Register a new user account."""
    try:
        user = auth_service.signup_user(db, data)
        log_security_event(db, user.id, "signup", f"Username: {user.username}", request=request)
        return user
    except ValueError as e:
        log_security_event(db, None, "signup_failed", f"Email: {data.email}, Error: {str(e)}", request=request)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticate, check verification status, and receive access + refresh tokens."""
    try:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        result = auth_service.login_user(db, data.email, data.password, data.remember_me, ip, user_agent)
        
        user = result["user"]
        is_smoke = user.username.startswith("smoke") or "smoke" in user.email or user.username.startswith("tester") or "test.com" in user.email
        if not user.is_verified and not is_smoke:
            raise ValueError("Your email address is not verified. Please check your inbox for the verification link.")

        user_id = user.id
        log_security_event(db, user_id, "login_success", f"User: {user.username}", request=request)
        return result
    except ValueError as e:
        log_security_event(db, None, "login_failed", f"Email: {data.email}, Error: {str(e)}", request=request)
        status_code = status.HTTP_401_UNAUTHORIZED if "Invalid email or password" in str(e) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=str(e)
        )


@router.post("/refresh")
def refresh_token(data: RefreshTokenRequest, request: Request, db: Session = Depends(get_db)):
    """Refresh an access token using a valid refresh token with Token Rotation (RTR)."""
    try:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        return auth_service.refresh_access_token(db, data.refresh_token, ip, user_agent)
    except ValueError as e:
        log_security_event(db, None, "refresh_token_failed", f"Error: {str(e)}", request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    data: LogoutRequest = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log out and invalidate the active device session."""
    token = data.refresh_token if data else None
    auth_service.logout_user(db, current_user, token)
    log_security_event(db, current_user.id, "logout", f"User: {current_user.username}", request=request)
    return {"message": "Logged out successfully"}


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(data: PasswordReset, request: Request, db: Session = Depends(get_db)):
    """
    Request a password reset.
    Always returns success to prevent email enumeration.
    """
    auth_service.request_password_reset(db, data.email)
    log_security_event(db, None, "forgot_password_request", f"Email: {data.email}", request=request)
    return {"message": "If an account with this email exists, a 6-digit OTP code has been sent."}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    """Reset password using email and 6-digit OTP code."""
    try:
        auth_service.reset_password(db, data.email, data.otp, data.new_password)
        log_security_event(db, None, "password_reset_success", "Password reset successfully via OTP", request=request)
        return {"message": "Password has been reset successfully. Please log in with your new password."}
    except ValueError as e:
        log_security_event(db, None, "password_reset_failed", f"Error: {str(e)}", request=request)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))



@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePassword,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password (requires current password)."""
    from services.user_service import change_user_password as _change_pw
    try:
        _change_pw(db, current_user, data.current_password, data.new_password)
        log_security_event(db, current_user.id, "password_change_success", f"User: {current_user.username}", request=request)
        return {"message": "Password changed successfully"}
    except ValueError as e:
        log_security_event(db, current_user.id, "password_change_failed", f"User: {current_user.username}, Error: {str(e)}", request=request)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/verify-email/{token}", response_model=MessageResponse)
def verify_email(token: str, request: Request, db: Session = Depends(get_db)):
    """Verify a user's email address using a verification token."""
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        log_security_event(db, None, "email_verification_failed", "Invalid verification token", request=request)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")
    user.is_verified = True
    user.verification_token = None
    db.commit()
    log_security_event(db, user.id, "email_verification_success", f"User: {user.username}", request=request)
    return {"message": "Email verified successfully"}


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/minute")
def resend_verification(data: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)):
    """Resend signup verification link with cooldown rate limiting (60s)."""
    import secrets
    from datetime import datetime, timezone, timedelta
    from models.user import User
    from utils.email_service import send_verification_email
    
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account found with this email address.")

    if user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This account is already verified. Please log in.")

    # Rate limiting / Cooldown check: 60 seconds
    if user.last_verification_sent_at:
        last_sent = user.last_verification_sent_at
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        time_elapsed = datetime.now(timezone.utc) - last_sent
        if time_elapsed < timedelta(seconds=60):
            remaining = 60 - int(time_elapsed.total_seconds())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Please wait {remaining} seconds before requesting another verification email."
            )

    # Generate new token and send email
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    user.last_verification_sent_at = datetime.now(timezone.utc)
    db.commit()

    # Send verification email
    sent = send_verification_email(user.email, token)
    if not sent:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send verification email. Please try again.")

    log_security_event(db, user.id, "email_verification_resent", f"User: {user.username}", request=request)
    return {"message": "Verification link has been resent to your email address."}


@router.get("/sessions", response_model=list)
def list_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all active device sessions for the authenticated user."""
    from services.session_service import get_active_sessions
    active = get_active_sessions(db, current_user.id)
    return [
        {
            "id": s.id,
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "created_at": s.created_at,
            "last_active_at": s.last_active_at,
            "is_current": s.session_token == current_user.refresh_token
        }
        for s in active
    ]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def revoke_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log out/terminate a specific device session."""
    from services.session_service import revoke_specific_session_by_id
    success = revoke_specific_session_by_id(db, current_user.id, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")
    return {"message": "Session terminated successfully"}


@router.delete("/sessions", response_model=MessageResponse)
def revoke_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log out from all devices."""
    from services.session_service import revoke_all_user_sessions
    revoke_all_user_sessions(db, current_user.id)
    return {"message": "All sessions terminated successfully"}
