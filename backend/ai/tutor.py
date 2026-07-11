"""
AI Tutor — conversational learning assistant powered by Gemini.
Provides contextual answers based on course content via RAG.
Gracefully degrades if google-generativeai is not installed.
"""

from typing import Optional, List

from config import settings

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from ai.embeddings import get_relevant_context
from prompts.tutor_prompts import TUTOR_SYSTEM_PROMPT, format_tutor_prompt


def initialize_gemini():
    """Initialize the Gemini API client."""
    if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)


def get_tutor_response(
    user_message: str,
    chat_history: List[dict] = None,
    course_context: Optional[str] = None,
    course_title: Optional[str] = None,
) -> dict:
    """
    Generate an AI tutor response using Gemini.
    Uses RAG to pull relevant course context when available.
    """
    if not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
        return {
            "response": "AI Tutor is currently unavailable. Please configure GEMINI_API_KEY to enable AI features.",
            "tokens_used": 0,
        }

    initialize_gemini()

    # Retrieve relevant context via FAISS if course context exists
    relevant_context = ""
    if course_context:
        try:
            relevant_context = get_relevant_context(user_message, course_context)
        except Exception:
            relevant_context = course_context[:2000]

    # Build the prompt
    prompt = format_tutor_prompt(
        user_message=user_message,
        course_title=course_title or "General",
        relevant_context=relevant_context,
    )

    # Build chat history for multi-turn conversation
    history = []
    if chat_history:
        for msg in chat_history[-10:]:  # Keep last 10 messages for context window
            role = "user" if msg["role"] == "user" else "model"
            history.append({"role": role, "parts": [msg["content"]]})

    try:
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=TUTOR_SYSTEM_PROMPT,
        )
        chat = model.start_chat(history=history)
        response = chat.send_message(prompt)

        return {
            "response": response.text,
            "tokens_used": response.usage_metadata.total_token_count if hasattr(response, "usage_metadata") else 0,
        }
    except Exception as error:
        return {
            "response": f"I apologize, but I encountered an error processing your question. Please try again. Error: {str(error)}",
            "tokens_used": 0,
        }
