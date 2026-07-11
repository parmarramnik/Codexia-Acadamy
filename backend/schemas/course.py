"""
Course, Module, and Lecture Pydantic schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


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


class LectureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = None
    order_index: Optional[int] = None
    duration_seconds: Optional[int] = None
    is_preview: Optional[bool] = None


class LectureResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    order_index: int
    duration_seconds: int
    is_preview: bool
    has_video: bool = False

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
    category: str
    difficulty: str = "beginner"
    tags: Optional[str] = None
    prerequisites: Optional[str] = None
    learning_objectives: Optional[str] = None
    price: float = 0.0


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=300)
    description: Optional[str] = Field(None, min_length=10)
    short_description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = None
    difficulty: Optional[str] = None
    tags: Optional[str] = None
    prerequisites: Optional[str] = None
    learning_objectives: Optional[str] = None
    price: Optional[float] = None
    is_published: Optional[bool] = None


class CourseResponse(BaseModel):
    id: int
    title: str
    slug: str
    description: str
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    instructor_id: int
    instructor_name: str = ""
    category: str
    difficulty: str
    duration_hours: float
    total_lectures: int
    is_published: bool
    is_approved: bool
    is_featured: bool
    price: float
    tags: Optional[str] = None
    prerequisites: Optional[str] = None
    learning_objectives: Optional[str] = None
    enrollment_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CourseListResponse(BaseModel):
    id: int
    title: str
    slug: str
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    instructor_name: str = ""
    category: str
    difficulty: str
    duration_hours: float
    total_lectures: int
    is_featured: bool
    price: float
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
