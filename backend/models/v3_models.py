"""
Codexia Academy v3.0 Database Models
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
)
from sqlalchemy.orm import relationship

from database import Base


class Contest(Base):
    __tablename__ = "contests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    submissions = relationship("ContestSubmission", back_populates="contest", cascade="all, delete-orphan")


class ContestSubmission(Base):
    __tablename__ = "contest_submissions"

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    points = Column(Integer, default=0)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    contest = relationship("Contest", back_populates="submissions")
    user = relationship("User")
    submission = relationship("Submission")


class SavedProblem(Base):
    __tablename__ = "saved_problems"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    problem_id = Column(Integer, ForeignKey("coding_problems.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    problem = relationship("CodingProblem")


class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(250), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_doubt = Column(Boolean, default=False, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    course = relationship("Course")
    replies = relationship("DiscussionReply", back_populates="discussion", cascade="all, delete-orphan")


class DiscussionReply(Base):
    __tablename__ = "discussion_replies"

    id = Column(Integer, primary_key=True, index=True)
    discussion_id = Column(Integer, ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    parent_reply_id = Column(Integer, ForeignKey("discussion_replies.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    discussion = relationship("Discussion", back_populates="replies")
    user = relationship("User")
    parent = relationship("DiscussionReply", remote_side=[id])


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])




class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(100), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")



class ResumeReview(Base):
    __tablename__ = "resume_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    raw_text = Column(Text, nullable=True)
    education_json = Column(Text, nullable=True)
    experience_json = Column(Text, nullable=True)
    skills_json = Column(Text, nullable=True)
    suggestions = Column(Text, nullable=True)
    score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    query = Column(String(300), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")


class CertificateDownload(Base):
    __tablename__ = "certificate_downloads"

    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    downloaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    certificate = relationship("Certificate")
    user = relationship("User")


class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    metric_key = Column(String(100), nullable=False, unique=True, index=True)
    metric_value_json = Column(Text, nullable=False)
    calculated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
