"""
AI Tutor core, shared by every tutor endpoint.

Course-grounded answers go through the RAG pipeline in ai/rag. Authorization is evaluated first;
only then is the selected course's material retrieved.
"""

import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from ai import llm
from ai.rag import embedder, index, service
from ai.rag.access import authorize_course_access
from ai.rag.errors import RagUnavailable
from config import settings
from models.course import Course
from models.user import User
from prompts.tutor_prompts import build_system_prompt, format_tutor_prompt

logger = logging.getLogger("codexia.tutor")


def prepare_course_context(db: Session, user: User, course_id: int, message: str):
    """
    Authorize, then retrieve. Raises RagAccessDenied before any course text is read.
    Returns (course, Retrieval | None); None means retrieval was skipped (e.g. a greeting).
    """
    course = authorize_course_access(db, user, course_id)
    if not settings.RAG_ENABLED or not service.needs_retrieval(message):
        return course, None
    try:
        service.sync_course_content(db, course)
        return course, service.retrieve(db, course.id, message)
    except (embedder.EmbeddingUnavailable, index.IndexUnavailable) as exc:
        raise RagUnavailable(str(exc)) from exc
    except Exception as exc:  # extraction/ingestion failure of the outline document
        if isinstance(exc, (ValueError, RuntimeError)):
            raise RagUnavailable("The course material could not be indexed. Please try again later.") from exc
        raise


def get_tutor_response(
    user_message: str,
    chat_history: Optional[List[dict]] = None,
    course: Optional[Course] = None,
    retrieval: Optional["service.Retrieval"] = None,
) -> dict:
    """
    Generate a tutor answer. Raises llm.LLMError on provider problems (callers turn it into an HTTP
    error; no canned answer is ever returned in its place).
    """
    if course is None:
        grounded = None
    else:
        grounded = bool(retrieval and retrieval.sources)
    prompt = format_tutor_prompt(user_message, course.title if course else None,
                                 retrieval.context if grounded else "")
    result = llm.generate(
        prompt,
        system_instruction=build_system_prompt(grounded),
        history=(chat_history or [])[-10:],
        temperature=0.4,
        max_output_tokens=2048,
    )
    answer, sources = result.text, []
    if grounded:
        answer, sources = service.resolve_citations(result.text, retrieval.sources)
    return {
        "response": answer,
        "tokens_used": result.tokens_used,
        "truncated": result.truncated,
        "grounded": bool(grounded),
        "sources": sources,
    }
