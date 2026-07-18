"""
Portfolio, Resume, and Achievement database models.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Portfolio(Base):
    """Tracks a student's project links, biographical detail, and skill statistics for visual portfolios."""
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    title = Column(String(300), nullable=True)
    bio = Column(Text, nullable=True)
    github_url = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    website_url = Column(String(500), nullable=True)
    projects_json = Column(Text, nullable=True)  # Stores serialized project details
    skills_json = Column(Text, nullable=True)    # Stores structured key-value skills data
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="portfolio_record")

    def __repr__(self):
        return f"<Portfolio(id={self.id}, user_id={self.user_id})>"


class Resume(Base):
    """Stores parsed and raw resume content for AI career course suggestions."""
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    raw_text = Column(Text, nullable=True)
    education_json = Column(Text, nullable=True)
    experience_json = Column(Text, nullable=True)
    skills_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="resume_record")

    def __repr__(self):
        return f"<Resume(id={self.id}, user_id={self.user_id})>"



