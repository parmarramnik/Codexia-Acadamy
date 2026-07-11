"""
Audit and security logging models for Enterprise-Level Security compliance.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class AuditLog(Base):
    """Tracks sensitive changes to records (e.g. role edits, resource deletes)."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g., "course_delete", "role_change"
    target_type = Column(String(50), nullable=False)  # e.g., "course", "user"
    target_id = Column(String(50), nullable=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    browser = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action='{self.action}', user_id={self.user_id})>"


class SecurityLog(Base):
    """Tracks authentication events (logins, failed attempts, resets)."""
    __tablename__ = "security_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(100), nullable=False)  # e.g., "login_success", "login_failed"
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    browser = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")

    def __repr__(self):
        return f"<SecurityLog(id={self.id}, event_type='{self.event_type}')>"
