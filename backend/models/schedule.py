"""
Reminder and StudyPlan database models.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Reminder(Base):
    """Stores schedule and deadline reminders set by students/instructors."""
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="reminders_list")

    def __repr__(self):
        return f"<Reminder(id={self.id}, title='{self.title}', user_id={self.user_id})>"


class StudyPlan(Base):
    """Allows students to configure goals for course progress and time commitments."""
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    target_hours_weekly = Column(Integer, default=5, nullable=False)
    daily_goal_minutes = Column(Integer, default=30, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="study_plans_list")
    course = relationship("Course")

    def __repr__(self):
        return f"<StudyPlan(id={self.id}, user_id={self.user_id}, course_id={self.course_id})>"
