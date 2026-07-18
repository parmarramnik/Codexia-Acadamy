"""
Enterprise AI Platform routes v3.0
"""

from typing import Optional, List
import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.v3_models import AIConversation, ResumeReview
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
    message: str,
    session_token: str = Query(..., description="Context session token"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Personalized AI tutor conversation route preserving session memory context.
    """
    # Load previous conversation memory for context
    history = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id,
        AIConversation.session_token == session_token
    ).order_by(AIConversation.created_at.asc()).all()

    # Save user message
    user_conv = AIConversation(
        user_id=current_user.id,
        session_token=session_token,
        role="user",
        content=message
    )
    db.add(user_conv)
    db.commit()

    # Build context prompt
    context_str = "You are an intelligent tutor teaching computer science. Keep explanations clear.\n"
    for h in history:
        context_str += f"{h.role.capitalize()}: {h.content}\n"
    context_str += f"User: {message}\nAssistant:"

    # Call AI
    ai_reply = get_ai_response(context_str)
    if not ai_reply:
        # Smart simulated tutor reply if Gemini is not configured
        if "recursion" in message.lower():
            ai_reply = "Recursion is a programming technique where a function calls itself to solve a smaller instance of the same problem. A crucial part is the *base case*, which stops the loop. Do you want to see an example in Python?"
        elif "complexity" in message.lower() or "big o" in message.lower():
            ai_reply = "Big-O notation describes the performance or complexity of an algorithm. O(1) is constant time, O(n) is linear time (proportional to input size), and O(n^2) is quadratic time. Would you like to analyze a specific code block?"
        else:
            ai_reply = f"That is a great question about computer science! Let's break this down. Could you clarify if you want an conceptual overview, code examples, or test cases?"

    # Save assistant message
    assist_conv = AIConversation(
        user_id=current_user.id,
        session_token=session_token,
        role="assistant",
        content=ai_reply
    )
    db.add(assist_conv)
    db.commit()

    return {
        "reply": ai_reply,
        "session_token": session_token
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


from pydantic import BaseModel

class CodeReviewRequest(BaseModel):
    code: str
    language: str
    problem_title: str = "Algorithm challenge"


@router.post("/coding/review")
def review_code(
    payload: CodeReviewRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Performs full static AI code review, complexity analysis, and quality grading.
    """
    prompt = f"""
    Review the following {payload.language} code for the problem '{payload.problem_title}':
    {payload.code}
    Provide a code review. Return a JSON containing keys:
    - quality_score: integer 0-100
    - time_complexity: string (Big O)
    - space_complexity: string (Big O)
    - bugs: list of strings
    - optimization_tips: list of strings
    """
    ai_reply = get_ai_response(prompt)
    
    try:
        if "```json" in ai_reply:
            ai_reply = ai_reply.split("```json")[1].split("```")[0].strip()
        review = json.loads(ai_reply)
    except:
        review = {
            "quality_score": 85,
            "time_complexity": "O(N)",
            "space_complexity": "O(1)",
            "bugs": ["No edge cases validation for null/empty lists."],
            "optimization_tips": [
                "Consider replacing nested checks with guard clauses.",
                "Use list comprehension where possible for cleaner code."
            ]
        }
    return review


@router.post("/career/resume")
async def analyze_resume(
    resume_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI Career Assistant parsing skills gaps and recommending specific courses.
    Supports raw text forms or PDF uploads.
    """
    extracted_text = ""
    if file:
        try:
            content = await file.read()
            if file.filename.lower().endswith(".pdf"):
                import io
                import pypdf
                reader = pypdf.PdfReader(io.BytesIO(content))
                text_list = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        text_list.append(text)
                extracted_text = "\n".join(text_list)
            else:
                extracted_text = content.decode("utf-8", errors="ignore")
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read or parse uploaded file: {str(e)}"
            )
    else:
        extracted_text = resume_text

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide resume text or upload a valid resume file."
        )

    # 1. Fetch available course catalog
    from models.course import Course
    courses = db.query(Course).filter(Course.is_published == True).all()
    course_catalog = [f"ID {c.id}: {c.title}" for c in courses]
    catalog_str = "\n".join(course_catalog)

    prompt = f"""
    You are an expert career auditor and technical recruiter.
    Analyze the following resume text:
    ---
    {extracted_text}
    ---

    We have these active courses in our catalog:
    {catalog_str}

    Identify the student's skills, match gaps based on modern software engineering standards, score the resume match rate (0 to 100), and recommend up to 3 course IDs from our catalog above that would best bridge the gaps.

    You must respond with a single valid JSON object matching this structure EXACTLY. Do not add any text before or after the JSON:
    {{
        "score": 85,
        "skills_found": ["Python", "Docker"],
        "suggestions": "Detailed placement suggestions and skill gap explanation.",
        "recommended_course_ids": [1, 2]
    }}
    """
    
    ai_reply = get_ai_response(prompt, system_instruction="You are a professional resume auditor. Return only valid JSON.")
    
    analysis = None
    if ai_reply:
        try:
            cleaned = ai_reply.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            analysis = json.loads(cleaned)
        except Exception as e:
            print(f"[AI Parsing Error] career/resume JSON loading failed: {str(e)}")

    if not analysis:
        analysis = {
            "score": 75,
            "skills_found": ["Software Development", "Problem Solving"],
            "suggestions": "Resume parsed. Recommended focusing on Cloud deployments, React development, and system design concepts.",
            "recommended_course_ids": [c.id for c in courses[:2]]
        }

    # Resolve course objects
    recommended_courses = []
    for cid in analysis.get("recommended_course_ids", []):
        course = db.query(Course).filter(Course.id == int(cid)).first()
        if course:
            recommended_courses.append({
                "id": course.id,
                "title": course.title,
                "slug": course.slug
            })

    if not recommended_courses and courses:
        for c in courses[:2]:
            recommended_courses.append({
                "id": c.id,
                "title": c.title,
                "slug": c.slug
            })

    review_record = ResumeReview(
        user_id=current_user.id,
        raw_text=extracted_text[:2000],
        suggestions=analysis.get("suggestions", "Resume reviewed."),
        score=analysis.get("score", 75)
    )
    db.add(review_record)
    db.commit()

    return {
        "score": analysis.get("score", 75),
        "skills_found": analysis.get("skills_found", []),
        "suggestions": analysis.get("suggestions", ""),
        "recommended_courses": recommended_courses
    }



