"""
Session and LoginHistory database models.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class Session(Base):
    """Tracks active user sessions for device management, rotation, and revocation."""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(500), unique=True, nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    last_active_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", backref="sessions_list")

    def __repr__(self):
        return f"<Session(id={self.id}, user_id={self.user_id}, is_active={self.is_active})>"


class LoginHistory(Base):
    """Logs authentication success/failure attempts for audit and lockout checks."""
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False)  # e.g., "success", "failed", "locked_out"
    failure_reason = Column(String(255), nullable=True)
    attempt_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", backref="login_history_list")

    def __repr__(self):
        return f"<LoginHistory(id={self.id}, status='{self.status}', user_id={self.user_id})>"
