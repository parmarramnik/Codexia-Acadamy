"""
Course, Module, Lecture, Enrollment, and Category models.
Courses are the central learning unit containing modules and lectures.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text, Float
)
from sqlalchemy.orm import relationship

from database import Base


class CourseCategory(str, enum.Enum):
    PROGRAMMING = "programming"
    WEB_DEVELOPMENT = "web_development"
    MACHINE_LEARNING = "machine_learning"
    ARTIFICIAL_INTELLIGENCE = "artificial_intelligence"
    DATA_SCIENCE = "data_science"
    DSA = "dsa"
    CYBER_SECURITY = "cyber_security"
    DEVOPS = "devops"
    CLOUD = "cloud"


class CourseDifficulty(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False, index=True)
    slug = Column(String(350), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    short_description = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    instructor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(Enum(CourseCategory), nullable=False, index=True)
    difficulty = Column(Enum(CourseDifficulty), default=CourseDifficulty.BEGINNER, nullable=False)
    duration_hours = Column(Float, default=0.0)
    total_lectures = Column(Integer, default=0)
    is_published = Column(Boolean, default=False, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    price = Column(Float, default=0.0)
    tags = Column(String(500), nullable=True)
    prerequisites = Column(Text, nullable=True)
    learning_objectives = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    instructor = relationship("User", back_populates="courses_created")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan", order_by="Module.order_index")
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    coding_problems = relationship("CodingProblem", back_populates="course", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="course", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="course", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Course(id={self.id}, title='{self.title}', category='{self.category}')>"


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    course = relationship("Course", back_populates="modules")
    lectures = relationship("Lecture", back_populates="module", cascade="all, delete-orphan", order_by="Lecture.order_index")

    def __repr__(self):
        return f"<Module(id={self.id}, title='{self.title}', order={self.order_index})>"


class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    duration_seconds = Column(Integer, default=0)
    is_preview = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    module = relationship("Module", back_populates="lectures")
    video = relationship("Video", back_populates="lecture", uselist=False, cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="lecture", cascade="all, delete-orphan")
    progress = relationship("Progress", back_populates="lecture", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="lecture", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Lecture(id={self.id}, title='{self.title}', order={self.order_index})>"


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    completion_percentage = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    def __repr__(self):
        return f"<Enrollment(user_id={self.user_id}, course_id={self.course_id})>"


class Category(Base):
    """Custom categories managed by admin, supplements the enum."""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(120), unique=True, nullable=False)
    description = Column(String(500), nullable=True)
    icon = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}')>"
