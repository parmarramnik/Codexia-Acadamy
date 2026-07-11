"""
Content generator — AI-powered quiz, flashcard, and note generation.
Gracefully degrades if google-generativeai is not installed.
"""

from typing import List, Optional
import json

from config import settings

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from prompts.generator_prompts import (
    NOTES_PROMPT,
    FLASHCARD_PROMPT,
    QUIZ_PROMPT,
)


def initialize_gemini():
    """Initialize the Gemini API client."""
    if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)


def _check_available() -> bool:
    """Check if AI generation is available."""
    return GEMINI_AVAILABLE and bool(settings.GEMINI_API_KEY)


def generate_notes(topic: str, course_title: Optional[str] = None) -> str:
    """Generate structured markdown notes on a topic."""
    if not _check_available():
        return f"# {topic}\n\nAI note generation is currently unavailable. Please configure GEMINI_API_KEY."

    initialize_gemini()
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        prompt = NOTES_PROMPT.format(topic=topic, course_title=course_title or "General")
        response = model.generate_content(prompt)
        return response.text
    except Exception as error:
        return f"Error generating notes: {str(error)}"


def generate_flashcards(topic: str, count: int = 5) -> List[dict]:
    """Generate flashcard Q&A pairs as a list of dicts."""
    if not _check_available():
        return [{"question": "AI unavailable", "answer": "Please configure GEMINI_API_KEY to enable flashcard generation."}]

    initialize_gemini()
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        prompt = FLASHCARD_PROMPT.format(topic=topic, count=count)
        response = model.generate_content(prompt)

        # Parse JSON response
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except (json.JSONDecodeError, Exception) as error:
        return [{"question": f"Error generating flashcards: {str(error)}", "answer": "Please try again."}]


def generate_quiz_questions(
    topic: str,
    count: int = 5,
    difficulty: str = "medium",
) -> List[dict]:
    """Generate quiz questions with answers."""
    if not _check_available():
        return [{"error": "AI unavailable. Please configure GEMINI_API_KEY."}]

    initialize_gemini()
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        prompt = QUIZ_PROMPT.format(topic=topic, count=count, difficulty=difficulty)
        response = model.generate_content(prompt)

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except (json.JSONDecodeError, Exception) as error:
        return [{"error": f"Error generating quiz: {str(error)}"}]
