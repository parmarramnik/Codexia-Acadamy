"""
Codexia Academy v4.0 Database Models
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Table
)
from sqlalchemy.orm import relationship

from database import Base
from models.user import Role, Permission, RolePermission
from models.v3_models import Contest


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")


class PasswordResetToken(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    is_used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")


class CourseReview(Base):
    __tablename__ = "course_reviews"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Float, nullable=False, default=5.0)  # e.g., 1.0 to 5.0
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    course = relationship("Course")
    user = relationship("User")


# Junction table for LearningPath Courses sequence
learning_path_courses = Table(
    "learning_path_courses",
    Base.metadata,
    Column("learning_path_id", Integer, ForeignKey("learning_paths.id", ondelete="CASCADE"), primary_key=True),
    Column("course_id", Integer, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("sequence_order", Integer, default=0),
    extend_existing=True
)


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    courses = relationship("Course", secondary=learning_path_courses, order_by="learning_path_courses.c.sequence_order")


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(String(255), nullable=False)
    filters_json = Column(Text, nullable=True)  # JSON representation of filters
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")


class CodingStatistics(Base):
    __tablename__ = "coding_statistics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    experience_points = Column(Integer, default=0, nullable=False)
    level = Column(Integer, default=1, nullable=False)
    daily_streak = Column(Integer, default=0, nullable=False)
    total_problems_solved = Column(Integer, default=0, nullable=False)
    unlocked_achievements_json = Column(Text, default="[]", nullable=False)  # JSON list of badges/achievements
    last_active_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")


class ContestRanking(Base):
    __tablename__ = "contest_rankings"

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rank = Column(Integer, nullable=False)
    score = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    contest = relationship("Contest")
    user = relationship("User")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    email_enabled = Column(Boolean, default=True, nullable=False)
    push_enabled = Column(Boolean, default=True, nullable=False)
    marketing_enabled = Column(Boolean, default=False, nullable=False)

    user = relationship("User")
