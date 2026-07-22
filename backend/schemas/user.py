"""
User Pydantic schemas for request validation and response serialization.
"""

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
import re


class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_user_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            email = str(data.get("email", "")).strip()
            prefix = email.split("@")[0] if "@" in email else email
            clean_username = re.sub(r"[^a-zA-Z0-9_-]", "", prefix) or "user"

            if not data.get("username"):
                data["username"] = clean_username
            if not data.get("full_name"):
                data["full_name"] = data.get("username") or clean_username
        return data

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: Optional[str]) -> str:
        val = (value or "user").strip()
        cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", val) or "user"
        return cleaned.lower()


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "student"

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: Optional[str]) -> Optional[str]:
        if value and value not in ["student", "instructor", "admin", "super_admin"]:
            raise ValueError("Role must be 'student', 'instructor', 'admin', or 'super_admin'")
        return value or "student"


class UserLogin(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str
    remember_me: Optional[bool] = False

    @model_validator(mode="before")
    @classmethod
    def validate_login_identifier(cls, data: Any) -> Any:
        if isinstance(data, dict):
            identifier = data.get("email") or data.get("username")
            if not identifier:
                raise ValueError("Email or username is required.")
            data["email"] = identifier
        return data



class ResendVerificationRequest(BaseModel):
    email: EmailStr


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    bio: Optional[str] = Field(None, max_length=1000)
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    password_hash: str
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class MessageResponse(BaseModel):
    message: str
