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
    RefreshTokenRequest, PasswordReset, PasswordResetConfirm,
    ChangePassword, MessageResponse,
)
from services import auth_service
from services.audit_service import log_security_event

router = APIRouter()


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticate and receive access + refresh tokens."""
    try:
        result = auth_service.login_user(db, data.email, data.password, data.remember_me)
        user_id = result["user"].id
        log_security_event(db, user_id, "login_success", f"User: {result['user'].username}", request=request)
        return result
    except ValueError as e:
        log_security_event(db, None, "login_failed", f"Email: {data.email}, Error: {str(e)}", request=request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/refresh")
def refresh_token(data: RefreshTokenRequest, request: Request, db: Session = Depends(get_db)):
    """Refresh an access token using a valid refresh token."""
    try:
        return auth_service.refresh_access_token(db, data.refresh_token)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log out and invalidate the refresh token."""
    auth_service.logout_user(db, current_user)
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
    return {"message": "If an account with this email exists, a reset link has been sent."}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: PasswordResetConfirm, request: Request, db: Session = Depends(get_db)):
    """Reset password using a valid reset token."""
    try:
        auth_service.reset_password(db, data.token, data.new_password)
        log_security_event(db, None, "password_reset_success", "Password reset successfully via token", request=request)
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
