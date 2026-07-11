"""
Notes routes — CRUD with markdown support and bookmarking.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.content import Note
from schemas.analytics import NoteCreate, NoteUpdate, NoteResponse
from schemas.user import MessageResponse

router = APIRouter()


@router.get("", response_model=list[NoteResponse])
def get_notes(
    course_id: Optional[int] = None,
    bookmarked: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all notes for the current user."""
    query = db.query(Note).filter(Note.user_id == current_user.id)
    if course_id:
        query = query.filter(Note.course_id == course_id)
    if bookmarked:
        query = query.filter(Note.is_bookmarked == True)
    if search:
        query = query.filter(
            Note.title.ilike(f"%{search}%") | Note.content.ilike(f"%{search}%")
        )
    return query.order_by(Note.updated_at.desc()).all()


@router.post("", response_model=NoteResponse)
def create_note(
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new note."""
    note = Note(
        user_id=current_user.id,
        course_id=data.course_id,
        lecture_id=data.lecture_id,
        title=data.title,
        content=data.content,
        is_ai_generated=False,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a note."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", response_model=MessageResponse)
def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a note."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}
