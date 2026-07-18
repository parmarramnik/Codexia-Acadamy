"""
Analytics, notification, note, flashcard, and certificate schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# --- Notes ---

class NoteCreate(BaseModel):
    course_id: Optional[int] = None
    lecture_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    content: Optional[str] = Field(None, min_length=1)
    is_bookmarked: Optional[bool] = None
    auto_commit_enabled: Optional[bool] = None
    auto_commit_interval: Optional[int] = None
    auto_commit_on_major_edit: Optional[bool] = None
    auto_commit_before_ai: Optional[bool] = None


class NoteResponse(BaseModel):
    id: int
    user_id: int
    course_id: Optional[int] = None
    lecture_id: Optional[int] = None
    title: str
    content: str
    is_ai_generated: bool
    is_bookmarked: bool
    current_branch_id: Optional[int] = None
    auto_commit_enabled: bool
    auto_commit_interval: int
    auto_commit_on_major_edit: bool
    auto_commit_before_ai: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Flashcards ---

class FlashcardCreate(BaseModel):
    course_id: int
    question: str = Field(..., min_length=3)
    answer: str = Field(..., min_length=1)


class FlashcardUpdate(BaseModel):
    question: Optional[str] = Field(None, min_length=3)
    answer: Optional[str] = Field(None, min_length=1)
    is_learned: Optional[bool] = None
    is_favorite: Optional[bool] = None
    difficulty_rating: Optional[int] = Field(None, ge=1, le=5)


class FlashcardResponse(BaseModel):
    id: int
    course_id: int
    question: str
    answer: str
    is_ai_generated: bool
    is_learned: bool
    is_favorite: bool
    difficulty_rating: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Certificates ---

class CertificateResponse(BaseModel):
    id: int
    certificate_uid: str
    user_id: int
    course_id: int
    user_full_name: str
    course_title: str
    instructor_name: str
    completion_date: datetime
    certificate_url: Optional[str] = None
    qr_code_url: Optional[str] = None
    is_valid: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CertificateVerifyResponse(BaseModel):
    is_valid: bool
    certificate_uid: str
    user_full_name: str
    course_title: str
    instructor_name: str
    completion_date: datetime


# --- Analytics ---

class DashboardAnalytics(BaseModel):
    total_courses_enrolled: int = 0
    completed_courses: int = 0
    total_study_hours: float = 0.0
    quizzes_taken: int = 0
    average_quiz_score: float = 0.0
    problems_solved: int = 0
    current_streak: int = 0
    certificates_earned: int = 0


class StudySessionResponse(BaseModel):
    date: str
    duration_minutes: int
    lectures_watched: int
    quizzes_completed: int
    problems_solved: int


class WeeklyProgress(BaseModel):
    week: str
    study_minutes: int
    lectures: int
    quizzes: int
    problems: int


class TopicStrength(BaseModel):
    topic: str
    score: float
    total_attempts: int


# --- Notifications ---

class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Announcements ---

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    content: str = Field(..., min_length=10)
    priority: int = Field(default=0, ge=0, le=10)
    expires_at: Optional[datetime] = None


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    priority: int
    is_active: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- AI Chat ---

class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    course_id: Optional[int] = None
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    tokens_used: int = 0


class AIGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    course_id: Optional[int] = None
    count: int = Field(default=5, ge=1, le=20)
    difficulty: Optional[str] = None


class AIDebugRequest(BaseModel):
    code: str = Field(..., min_length=1)
    language: str
    error_message: Optional[str] = None


class AIDebugResponse(BaseModel):
    explanation: str
    fixed_code: Optional[str] = None
    suggestions: List[str] = []
