"""
Content models: Video, Resource, Note, Flashcard, Bookmark.
These are the learning content items attached to courses and lectures.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text
)
from sqlalchemy.orm import relationship

from database import Base


class ResourceType(str, enum.Enum):
    PDF = "pdf"
    DOCUMENT = "document"
    LINK = "link"
    CODE = "code"
    OTHER = "other"


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), unique=True, nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=True)
    file_size_mb = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    mime_type = Column(String(50), default="video/mp4")
    thumbnail_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    lecture = relationship("Lecture", back_populates="video")

    def __repr__(self):
        return f"<Video(id={self.id}, lecture_id={self.lecture_id})>"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    resource_type = Column(Enum(ResourceType), default=ResourceType.PDF, nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=True)
    file_size_mb = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    lecture = relationship("Lecture", back_populates="resources")

    def __repr__(self):
        return f"<Resource(id={self.id}, title='{self.title}')>"


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    is_bookmarked = Column(Boolean, default=False, nullable=False)
    current_branch_id = Column(Integer, ForeignKey("git_branches.id", ondelete="SET NULL"), nullable=True)
    auto_commit_enabled = Column(Boolean, default=False, nullable=False)
    auto_commit_interval = Column(Integer, default=30, nullable=False)
    auto_commit_on_major_edit = Column(Boolean, default=True, nullable=False)
    auto_commit_before_ai = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="notes")

    def __repr__(self):
        return f"<Note(id={self.id}, title='{self.title}')>"


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    is_learned = Column(Boolean, default=False, nullable=False)
    is_favorite = Column(Boolean, default=False, nullable=False)
    difficulty_rating = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    course = relationship("Course", back_populates="flashcards")

    def __repr__(self):
        return f"<Flashcard(id={self.id}, course_id={self.course_id})>"


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lecture_id = Column(Integer, ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="bookmarks")
    lecture = relationship("Lecture", back_populates="bookmarks")

    def __repr__(self):
        return f"<Bookmark(id={self.id}, user_id={self.user_id}, lecture_id={self.lecture_id})>"
