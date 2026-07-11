"""
Admin routes — user management, course approval, announcements, site stats.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from database import get_db
from auth.permissions import require_role
from models.user import User, UserRole
from models.analytics import Announcement
from schemas.analytics import AnnouncementCreate, AnnouncementResponse
from schemas.user import MessageResponse
from services import user_service, course_service

router = APIRouter()


@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Get site-wide statistics for the admin dashboard."""
    user_stats = user_service.get_user_stats(db)
    course_stats = course_service.get_course_stats(db)
    return {**user_stats, **course_stats}


@router.get("/pending-courses")
def get_pending_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Get courses pending approval."""
    from models.course import Course
    result = course_service.list_courses(
        db, page, page_size, published_only=False,
    )
    # Filter to only pending
    pending = [c for c in result.items if c.is_published and not c.is_approved]
    return {"items": pending, "total": len(pending)}


@router.get("/announcements", response_model=list[AnnouncementResponse])
def list_announcements(
    db: Session = Depends(get_db),
):
    """List all active announcements (public)."""
    now = datetime.now(timezone.utc)
    announcements = (
        db.query(Announcement)
        .filter(
            Announcement.is_active == True,
            (Announcement.expires_at == None) | (Announcement.expires_at > now),
        )
        .order_by(Announcement.priority.desc(), Announcement.created_at.desc())
        .all()
    )
    return announcements


@router.post("/announcements", response_model=AnnouncementResponse)
def create_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Create a new announcement (admin only)."""
    announcement = Announcement(
        title=data.title,
        content=data.content,
        author_id=current_user.id,
        priority=data.priority,
        expires_at=data.expires_at,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.delete("/announcements/{announcement_id}", response_model=MessageResponse)
def delete_announcement(
    announcement_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Delete an announcement (admin only)."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully"}
