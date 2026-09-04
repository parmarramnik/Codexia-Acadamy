"""
Flashcard routes — CRUD, AI-generated, shuffle, learn/favorite.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import random

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.content import Flashcard
from schemas.analytics import FlashcardCreate, FlashcardUpdate, FlashcardResponse
from schemas.user import MessageResponse
from utils.cache import cache_get, cache_set, cache_invalidate_prefix

router = APIRouter()


@router.get("", response_model=list[FlashcardResponse])
def get_flashcards(
    course_id: Optional[int] = None,
    learned: Optional[bool] = None,
    favorite: Optional[bool] = None,
    shuffle: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get flashcards, optionally filtered and shuffled."""
    cache_key = f"flashcards:user:{current_user.id}:{course_id or 'all'}:{learned or 'all'}:{favorite or 'all'}"
    if not shuffle:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

    query = db.query(Flashcard)
    if course_id:
        query = query.filter(Flashcard.course_id == course_id)
    if learned is not None:
        query = query.filter(Flashcard.is_learned == learned)
    if favorite:
        query = query.filter(Flashcard.is_favorite == True)
    # Show user's flashcards + AI-generated ones for their courses
    query = query.filter(
        (Flashcard.user_id == current_user.id) | (Flashcard.user_id == None)
    )

    cards = query.order_by(Flashcard.created_at.desc()).all()
    if shuffle:
        random.shuffle(cards)
        return cards

    result = [FlashcardResponse.model_validate(c).model_dump() for c in cards]
    cache_set(cache_key, result, ttl=300)
    return result


@router.post("", response_model=FlashcardResponse)
def create_flashcard(
    data: FlashcardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new flashcard."""
    flashcard = Flashcard(
        course_id=data.course_id,
        user_id=current_user.id,
        question=data.question,
        answer=data.answer,
        is_ai_generated=False,
    )
    db.add(flashcard)
    db.commit()
    db.refresh(flashcard)
    cache_invalidate_prefix(f"flashcards:user:{current_user.id}")
    return flashcard


@router.patch("/{flashcard_id}", response_model=FlashcardResponse)
def update_flashcard(
    flashcard_id: int,
    data: FlashcardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a flashcard (mark learned, favorite, etc.)."""
    flashcard = db.query(Flashcard).filter(Flashcard.id == flashcard_id).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(flashcard, field, value)
    db.commit()
    db.refresh(flashcard)
    cache_invalidate_prefix(f"flashcards:user:{current_user.id}")
    return flashcard


@router.delete("/{flashcard_id}", response_model=MessageResponse)
def delete_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a flashcard."""
    flashcard = db.query(Flashcard).filter(
        Flashcard.id == flashcard_id, Flashcard.user_id == current_user.id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    db.delete(flashcard)
    db.commit()
    cache_invalidate_prefix(f"flashcards:user:{current_user.id}")
    return {"message": "Flashcard deleted successfully"}
