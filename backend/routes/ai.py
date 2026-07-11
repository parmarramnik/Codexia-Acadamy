"""
AI routes — tutor chat, content generation, code debugging.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.analytics import ChatHistory
from models.content import Note, Flashcard
from schemas.analytics import (
    ChatMessage, ChatResponse,
    AIGenerateRequest, AIDebugRequest, AIDebugResponse,
    NoteResponse, FlashcardResponse,
)
from ai.tutor import get_tutor_response
from ai.generator import generate_notes, generate_flashcards, generate_quiz_questions
from ai.code_helper import debug_code, generate_hints

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat_with_tutor(
    data: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to the AI tutor and get a response."""
    session_id = data.session_id or str(uuid.uuid4())

    # Load chat history for this session
    history_records = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == current_user.id,
            ChatHistory.session_id == session_id,
        )
        .order_by(ChatHistory.created_at.asc())
        .limit(20)
        .all()
    )
    chat_history = [{"role": h.role, "content": h.content} for h in history_records]

    # Get course context if course_id provided
    course_context = None
    course_title = None
    if data.course_id:
        from services.course_service import get_course_by_id
        course = get_course_by_id(db, data.course_id)
        if course:
            course_title = course.title
            course_context = course.description

    # Get AI response
    result = get_tutor_response(
        user_message=data.message,
        chat_history=chat_history,
        course_context=course_context,
        course_title=course_title,
    )

    # Save user message
    user_msg = ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        role="user",
        content=data.message,
        course_id=data.course_id,
    )
    db.add(user_msg)

    # Save AI response
    ai_msg = ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        role="assistant",
        content=result["response"],
        course_id=data.course_id,
        tokens_used=result.get("tokens_used", 0),
    )
    db.add(ai_msg)
    db.commit()

    return ChatResponse(
        response=result["response"],
        session_id=session_id,
        tokens_used=result.get("tokens_used", 0),
    )


@router.post("/generate/notes", response_model=NoteResponse)
def generate_ai_notes(
    data: AIGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate AI-powered notes on a topic."""
    content = generate_notes(data.topic, data.topic)

    note = Note(
        user_id=current_user.id,
        course_id=data.course_id,
        title=f"AI Notes: {data.topic}",
        content=content,
        is_ai_generated=True,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.post("/generate/flashcards")
def generate_ai_flashcards(
    data: AIGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate AI-powered flashcards on a topic."""
    cards_data = generate_flashcards(data.topic, data.count)

    created_cards = []
    for card_data in cards_data:
        if "question" in card_data and "answer" in card_data:
            flashcard = Flashcard(
                course_id=data.course_id or 0,
                user_id=current_user.id,
                question=card_data["question"],
                answer=card_data["answer"],
                is_ai_generated=True,
            )
            db.add(flashcard)
            db.flush()
            created_cards.append(flashcard)

    db.commit()
    return [FlashcardResponse.model_validate(c) for c in created_cards]


@router.post("/generate/quiz")
def generate_ai_quiz(
    data: AIGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate AI-powered quiz questions."""
    questions = generate_quiz_questions(data.topic, data.count, data.difficulty or "medium")
    return {"questions": questions, "topic": data.topic}


@router.post("/debug", response_model=AIDebugResponse)
def debug_user_code(
    data: AIDebugRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Debug code using AI."""
    result = debug_code(data.code, data.language, data.error_message)
    return AIDebugResponse(**result)


@router.post("/recommend")
def recommend_next_topic(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recommend the next topic based on user progress."""
    from models.course import Enrollment, Course

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.id, Enrollment.is_active == True)
        .all()
    )

    if not enrollments:
        return {"recommendation": "Start by enrolling in a course that interests you!"}

    # Find the course with least completion
    least_complete = min(enrollments, key=lambda e: e.completion_percentage)
    course = db.query(Course).filter(Course.id == least_complete.course_id).first()

    return {
        "recommendation": f"Continue with '{course.title}' — you're {least_complete.completion_percentage:.0f}% complete!",
        "course_id": course.id,
        "course_title": course.title,
        "completion_percentage": least_complete.completion_percentage,
    }
