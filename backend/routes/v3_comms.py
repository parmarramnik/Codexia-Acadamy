"""
Collaborative Forums & Direct Messaging routes v3.0
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.analytics import Notification, Announcement, NotificationType
from models.v3_models import Discussion, DiscussionReply, DirectMessage

router = APIRouter(prefix="/comms", tags=["Communications Platform"])


@router.get("/discussions", response_model=List[dict])
def list_discussions(
    course_id: Optional[int] = Query(None),
    is_doubt: Optional[bool] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """List forum discussion threads."""
    query = db.query(Discussion)
    if course_id:
        query = query.filter(Discussion.course_id == course_id)
    if is_doubt is not None:
        query = query.filter(Discussion.is_doubt == is_doubt)
    if is_resolved is not None:
        query = query.filter(Discussion.is_resolved == is_resolved)
        
    discussions = query.order_by(Discussion.created_at.desc()).all()
    results = []
    for d in discussions:
        results.append({
            "id": d.id,
            "title": d.title,
            "content": d.content,
            "is_doubt": d.is_doubt,
            "is_resolved": d.is_resolved,
            "created_at": d.created_at,
            "user": {
                "id": d.user.id,
                "full_name": d.user.full_name,
                "avatar_url": d.user.avatar_url
            },
            "replies_count": len(d.replies)
        })
    return results


@router.post("/discussions")
def create_discussion(
    title: str,
    content: str,
    course_id: Optional[int] = None,
    is_doubt: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new discussion thread or doubt resolution ticket."""
    discussion = Discussion(
        course_id=course_id,
        user_id=current_user.id,
        title=title,
        content=content,
        is_doubt=is_doubt
    )
    db.add(discussion)
    db.commit()
    db.refresh(discussion)
    return {"status": "created", "discussion_id": discussion.id}


@router.post("/discussions/{discussion_id}/replies")
def reply_to_discussion(
    discussion_id: int,
    content: str,
    parent_reply_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post a reply to a discussion thread."""
    discussion = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not discussion:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    reply = DiscussionReply(
        discussion_id=discussion_id,
        user_id=current_user.id,
        content=content,
        parent_reply_id=parent_reply_id
    )
    db.add(reply)
    
    # Notify thread owner if reply is by another user
    if discussion.user_id != current_user.id:
        notif = Notification(
            user_id=discussion.user_id,
            notification_type=NotificationType.FORUM,
            title="New reply on your thread",
            message=f"{current_user.full_name} replied to '{discussion.title}'",
            is_read=False,
            link=f"/discussions/{discussion.id}"
        )
        db.add(notif)
        
    db.commit()
    return {"status": "reply_added"}


@router.get("/discussions/{discussion_id}")
def get_discussion_details(discussion_id: int, db: Session = Depends(get_db)):
    """Fetch discussion details with all reply structures."""
    discussion = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not discussion:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    replies_res = []
    for r in discussion.replies:
        replies_res.append({
            "id": r.id,
            "content": r.content,
            "parent_reply_id": r.parent_reply_id,
            "created_at": r.created_at,
            "user": {
                "id": r.user.id,
                "full_name": r.user.full_name,
                "avatar_url": r.user.avatar_url
            }
        })
        
    return {
        "id": discussion.id,
        "title": discussion.title,
        "content": discussion.content,
        "is_doubt": discussion.is_doubt,
        "is_resolved": discussion.is_resolved,
        "created_at": discussion.created_at,
        "user": {
            "id": discussion.user.id,
            "full_name": discussion.user.full_name,
            "avatar_url": discussion.user.avatar_url
        },
        "replies": replies_res
    }


@router.patch("/discussions/{discussion_id}/resolve")
def resolve_doubt(
    discussion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a doubt ticket as resolved."""
    discussion = db.query(Discussion).filter(Discussion.id == discussion_id).first()
    if not discussion:
        raise HTTPException(status_code=404, detail="Thread not found")
    if discussion.user_id != current_user.id and current_user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    discussion.is_resolved = True
    db.commit()
    return {"status": "resolved"}


@router.get("/messages")
def get_direct_messages(
    with_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get conversation log with a specific user."""
    msgs = db.query(DirectMessage).filter(
        or_(
            (DirectMessage.sender_id == current_user.id) & (DirectMessage.receiver_id == with_user_id),
            (DirectMessage.sender_id == with_user_id) & (DirectMessage.receiver_id == current_user.id)
        )
    ).order_by(DirectMessage.created_at.asc()).all()
    
    # Mark messages from the other user as read
    db.query(DirectMessage).filter(
        DirectMessage.sender_id == with_user_id,
        DirectMessage.receiver_id == current_user.id,
        DirectMessage.is_read == False
    ).update({DirectMessage.is_read: True})
    db.commit()
    
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "message": m.message,
            "is_read": m.is_read,
            "created_at": m.created_at
        } for m in msgs
    ]


@router.post("/messages")
def send_direct_message(
    receiver_id: int,
    message: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a direct chat message to another user."""
    dm = DirectMessage(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message=message
    )
    db.add(dm)
    
    # Send direct message notification alert
    notif = Notification(
        user_id=receiver_id,
        notification_type=NotificationType.INFO,
        title=f"New message from {current_user.full_name}",
        message=message[:60] + "..." if len(message) > 60 else message,
        is_read=False,
        link=f"/messages?with={current_user.id}"
    )
    db.add(notif)
    db.commit()
    return {"status": "sent"}


@router.get("/notifications")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch user alert notifications."""
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "link": n.link,
            "created_at": n.created_at
        } for n in notifs
    ]


@router.patch("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification alert as read."""
    notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "marked_read"}
