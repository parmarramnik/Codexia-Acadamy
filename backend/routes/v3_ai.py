"""
Enterprise AI Platform routes v3.0
"""

from typing import Optional
import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.v3_models import AIConversation
from config import settings

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

router = APIRouter(prefix="/ai", tags=["Enterprise AI Platform"])


def get_ai_response(prompt: str, system_instruction: str = None) -> str:
    """Helper to query Gemini if configured, else fallback to mock payload."""
    if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                system_instruction=system_instruction
            )
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            print(f"[AI Error] API Key failure or quota exceeded: {str(e)}")
            return ""
    
    # Fallback simulation
    return ""


@router.post("/tutor/chat")
def tutor_chat(
    message: str = Query(..., min_length=1, max_length=5000),
    session_token: str = Query(..., max_length=100, description="Context session token"),
    course_id: Optional[int] = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Personalized AI tutor conversation preserving session memory. Uses the same tutor core as
    /ai/chat; with course_id the answer is grounded in that course's material (authorization first).
    """
    from ai.tutor import get_tutor_response, prepare_course_context

    history = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id,
        AIConversation.session_token == session_token
    ).order_by(AIConversation.created_at.asc()).limit(20).all()
    chat_history = [{"role": h.role, "content": h.content} for h in history]

    course, retrieval = None, None
    if course_id:
        course, retrieval = prepare_course_context(db, current_user, course_id, message)

    # Errors (LLMError, RagAccessDenied, RagUnavailable) propagate to the app handlers as HTTP errors;
    # nothing is stored for a failed turn and no canned reply is invented.
    result = get_tutor_response(message, chat_history, course=course, retrieval=retrieval)

    db.add(AIConversation(user_id=current_user.id, session_token=session_token, role="user", content=message))
    db.add(AIConversation(user_id=current_user.id, session_token=session_token, role="assistant",
                          content=result["response"]))
    db.commit()

    return {
        "reply": result["response"],
        "session_token": session_token,
        "grounded": result["grounded"],
        "sources": result["sources"],
        "truncated": result["truncated"],
    }


@router.post("/planner/weekly")
def generate_study_planner(
    course_title: str,
    hours_weekly: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a personalized weekly study planner roadmap.
    """
    prompt = f"""
    Create a weekly study plan for {course_title} targeting {hours_weekly} hours per week.
    You must return a single valid JSON object with the following exact keys:
    {{
        "course": "{course_title}",
        "target_hours": {hours_weekly},
        "schedule": [
            {{"day": "Monday", "topic": "detailed study targets", "mins": 90}},
            {{"day": "Wednesday", "topic": "detailed study targets", "mins": 120}},
            {{"day": "Friday", "topic": "detailed study targets", "mins": 90}},
            {{"day": "Saturday", "topic": "detailed study targets", "mins": 180}}
        ]
    }}
    Do not add any text before or after the JSON. Return only the JSON content.
    """
    ai_reply = get_ai_response(prompt, system_instruction="You are a smart curriculum planner. Respond only with valid JSON.")
    
    plan = None
    if ai_reply:
        try:
            cleaned = ai_reply.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            plan = json.loads(cleaned)
        except Exception as e:
            print(f"[AI Parsing Error] planner/weekly JSON loading failed: {str(e)}")
            
    if not plan or "schedule" not in plan:
        plan = {
            "course": course_title,
            "target_hours": hours_weekly,
            "schedule": [
                {"day": "Monday", "topic": f"Introduction to {course_title} & Environment Setup", "mins": 90},
                {"day": "Wednesday", "topic": f"Core Syntax, Data Types & Variables of {course_title}", "mins": 120},
                {"day": "Friday", "topic": f"Working with Control Structures & Functions in {course_title}", "mins": 90},
                {"day": "Saturday", "topic": f"Building a mini-project using {course_title} concepts", "mins": 180}
            ]
        }
    return plan


from pydantic import BaseModel, Field


class CodeReviewRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50000)
    language: str = Field(..., max_length=30)
    problem_title: str = Field("Algorithm challenge", max_length=300)


@router.post("/coding/review")
def review_code(
    payload: CodeReviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI code review of exactly the code in the request. Returns validated, structured findings
    (summary, categorised issues vs suggestions with real line numbers, recommendations, corrected
    code). A provider failure or unparseable reply is an HTTP error, never an invented review.
    """
    from ai.code_review import review_code as run_review

    return run_review(payload.code, payload.language, payload.problem_title)
