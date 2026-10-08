"""
Course, Module, and Lecture Pydantic schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, model_validator


class _EffectivePriceMixin(BaseModel):
    """`price` is a display-only legacy field: report 0 unless the course is actually PAID."""

    @model_validator(mode="after")
    def _zero_price_unless_paid(self):
        if (self.pricing_type or "FREE").upper() != "PAID":
            self.price = 0.0
        return self


class ModuleCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=300)
    description: Optional[str] = None
    order_index: int = 0


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = None
    order_index: Optional[int] = None


class LectureCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=300)
    description: Optional[str] = None
    order_index: int = 0
    duration_seconds: int = 0
    is_preview: bool = False
    video_url: Optional[str] = None


class LectureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = None
    order_index: Optional[int] = None
    duration_seconds: Optional[int] = None
    is_preview: Optional[bool] = None
    video_url: Optional[str] = None


class LectureResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    order_index: int
    duration_seconds: int
    is_preview: bool
    has_video: bool = False
    video_url: Optional[str] = None
    locked: bool = False  # True when the course is paid and the viewer has not purchased it
    source_url: Optional[str] = None  # Stored video source; only returned to the course owner/admins

    class Config:
        from_attributes = True


class ModuleResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    order_index: int
    lectures: List[LectureResponse] = []

    class Config:
        from_attributes = True


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    description: str = Field(..., min_length=10)
    short_description: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = None
    category: str
    difficulty: str = "beginner"
    tags: Optional[str] = None
    prerequisites: Optional[str] = None
    learning_objectives: Optional[str] = None
    # Accepted for backwards compatibility but ignored: new courses start FREE and
    # pricing is set by an admin via /api/pricing (instructors submit price requests).
    price: float = 0.0


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=300)
    description: Optional[str] = Field(None, min_length=10)
    short_description: Optional[str] = Field(None, max_length=500)
    thumbnail_url: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[str] = None
    prerequisites: Optional[str] = None
    learning_objectives: Optional[str] = None
    price: Optional[float] = None  # Ignored — see CourseCreate.price
    is_published: Optional[bool] = None


class CourseResponse(_EffectivePriceMixin):
    id: int
    title: str
    slug: str
    description: str
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    instructor_id: int
    instructor_name: str = ""
    instructor_avatar_url: Optional[str] = None
    instructor_bio: Optional[str] = None
    category: str
    difficulty: str
    duration_hours: float
    total_lectures: int
    is_published: bool
    is_approved: bool
    is_featured: bool
    price: float
    pricing_type: str = "FREE"
    price_amount: int = 0
    currency: str = "INR"
    is_purchasable: bool = True
    tags: Optional[str] = None
    prerequisites: Optional[str] = None
    learning_objectives: Optional[str] = None
    enrollment_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CourseListResponse(_EffectivePriceMixin):
    id: int
    title: str
    slug: str
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    instructor_name: str = ""
    instructor_avatar_url: Optional[str] = None
    category: str
    difficulty: str
    duration_hours: float
    total_lectures: int
    is_featured: bool
    price: float
    pricing_type: str = "FREE"
    price_amount: int = 0
    currency: str = "INR"
    enrollment_count: int = 0

    class Config:
        from_attributes = True


class EnrollmentResponse(BaseModel):
    id: int
    user_id: int
    course_id: int
    enrolled_at: datetime
    completion_percentage: float
    is_active: bool

    class Config:
        from_attributes = True


class ProgressUpdate(BaseModel):
    watch_percentage: float = Field(..., ge=0.0, le=100.0)
    last_position_seconds: int = Field(..., ge=0)
