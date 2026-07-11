"""
Analytics routes — dashboard stats, study sessions, notifications.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from schemas.analytics import (
    DashboardAnalytics, NotificationResponse,
)
from schemas.user import MessageResponse
from services import analytics_service

router = APIRouter()


@router.get("/dashboard", response_model=DashboardAnalytics)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get learning analytics for the current user."""
    return analytics_service.get_dashboard_analytics(db, current_user.id)


@router.get("/sessions")
def get_study_sessions(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get study sessions for analytics and heatmaps."""
    sessions = analytics_service.get_study_sessions(db, current_user.id, days)
    return [
        {
            "date": s.date.isoformat(),
            "duration_minutes": s.duration_minutes,
            "lectures_watched": s.lectures_watched,
            "quizzes_completed": s.quizzes_completed,
            "problems_solved": s.problems_solved,
        }
        for s in sessions
    ]


@router.get("/notifications", response_model=list[NotificationResponse])
def get_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get notifications for the current user."""
    return analytics_service.get_user_notifications(db, current_user.id, unread_only)


@router.patch("/notifications/{notification_id}/read", response_model=MessageResponse)
def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    analytics_service.mark_notification_read(db, notification_id, current_user.id)
    return {"message": "Notification marked as read"}
