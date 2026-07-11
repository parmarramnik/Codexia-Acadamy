"""
Certificate model with unique certificate ID and QR verification support.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship

from database import Base


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    certificate_uid = Column(
        String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    user_full_name = Column(String(200), nullable=False)
    course_title = Column(String(300), nullable=False)
    instructor_name = Column(String(200), nullable=False)
    completion_date = Column(DateTime, nullable=False)
    certificate_url = Column(String(500), nullable=True)
    qr_code_url = Column(String(500), nullable=True)
    is_valid = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="certificates")
    course = relationship("Course", back_populates="certificates")

    def __repr__(self):
        return f"<Certificate(uid='{self.certificate_uid}', user_id={self.user_id})>"
