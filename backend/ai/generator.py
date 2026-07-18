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
        print(f"[AI Error] generate_notes failed: {str(error)}")
        return f"# Learning Notes: {topic}\n\n### Core Concepts\n* **Definitions**: Fundamentals of the topic are critical to programming architecture.\n* **Implementation**: Ensure clean imports, structured scopes, and error boundaries.\n* **Optimizations**: Avoid nested loops, cache results, and use proper indexing."


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
        print(f"[AI Error] generate_flashcards failed: {str(error)}")
        return [
            {"question": f"What is the primary goal of studying {topic}?", "answer": "To understand core concepts, algorithmic complexity, and structure clean implementations."},
            {"question": f"What is a common pitfall in {topic} designs?", "answer": "Failing to account for edge cases, null checks, and boundary conditions."}
        ]


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
        print(f"[AI Error] generate_quiz_questions failed: {str(error)}")
        return [
            {
                "question": f"Which of the following is correct regarding {topic}?",
                "options": ["It increases performance", "It reduces design complexity", "It requires proper boundary testing", "All of the above"],
                "correct_answer": "All of the above",
                "explanation": "Proper understanding of this topic enables optimized code structures and error-free execution."
            }
        ]


def generate_commit_message(diff_text: str) -> str:
    """Generate a high-quality summary commit message from a note diff."""
    if not _check_available():
        return "Updated note content"

    initialize_gemini()
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        prompt = (
            "You are a helpful Git assistant for a note taking app. Summarize the changes made in this note in a single line "
            "suitable for a commit message (maximum 72 characters). Start with a verb like 'Added', 'Updated', 'Fixed', etc. "
            "Be specific about what was changed, added, or deleted based on the diff.\n\n"
            f"Here is the diff:\n{diff_text}\n\n"
            "Return ONLY the single line commit message. Do not include markdown or quotes."
        )
        response = model.generate_content(prompt)
        return response.text.strip().replace('"', '').replace("'", "")
    except Exception as error:
        print(f"[AI Error] generate_commit_message failed: {str(error)}")
        return "Updated note content"
