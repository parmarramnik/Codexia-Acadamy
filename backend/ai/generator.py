"""
Content generator — AI-powered quiz, flashcard and note generation.

Failures raise ai.llm.LLMError (mapped to HTTP errors by the app). Nothing here substitutes canned
questions, cards or notes for a failed generation, because those would be saved as real content.
"""

import json
import re
from typing import List, Optional

from ai import llm
from ai.code_review import parse_json_array
from prompts.generator_prompts import FLASHCARD_PROMPT, NOTES_PROMPT, QUIZ_PROMPT

_SYSTEM = "You write accurate educational content. Follow the requested output format exactly."


def generate_notes(topic: str, course_title: Optional[str] = None) -> str:
    """Structured Markdown notes on a topic."""
    prompt = NOTES_PROMPT.format(topic=topic, course_title=course_title or "General")
    return llm.generate(prompt, system_instruction=_SYSTEM, max_output_tokens=4096).text


def generate_flashcards(topic: str, count: int = 5) -> List[dict]:
    """Flashcard Q&A pairs. Raises LLMError(MALFORMED) if no usable card comes back."""
    result = llm.generate(FLASHCARD_PROMPT.format(topic=topic, count=count), system_instruction=_SYSTEM,
                          json_mode=True, temperature=0.5, max_output_tokens=4096)
    cards = [
        {"question": str(c["question"]).strip(), "answer": str(c["answer"]).strip()}
        for c in parse_json_array(result.text)
        if isinstance(c, dict) and str(c.get("question", "")).strip() and str(c.get("answer", "")).strip()
    ]
    if not cards:
        raise llm.LLMError(llm.MALFORMED)
    return cards[:count]


def normalize_quiz_question(raw: dict) -> Optional[dict]:
    """
    Validate one generated question and expose `correct_answer` (the option text) derived from the model's
    `correct_index`. Returns None when the question is unusable (no 2+ options, or no identifiable answer).
    """
    if not isinstance(raw, dict):
        return None
    question = str(raw.get("question", "")).strip()
    options = [str(o).strip() for o in (raw.get("options") or []) if str(o).strip()]
    if not question or len(options) < 2:
        return None
    correct = None
    index = raw.get("correct_index")
    if isinstance(index, int) and not isinstance(index, bool) and 0 <= index < len(options):
        correct = options[index]
    elif raw.get("correct_answer") is not None:
        answer = str(raw["correct_answer"]).strip()
        match = [o for o in options if o.lower() == answer.lower()]
        if match:
            correct = match[0]
        elif re.fullmatch(r"[A-Da-d]", answer) and ord(answer.upper()) - 65 < len(options):
            correct = options[ord(answer.upper()) - 65]
    if correct is None:
        return None
    return {"question": question, "options": options, "correct_answer": correct,
            "correct_index": options.index(correct), "explanation": str(raw.get("explanation", "")).strip()}


def generate_quiz_questions(topic: str, count: int = 5, difficulty: str = "medium") -> List[dict]:
    """Validated multiple-choice questions. Raises LLMError(MALFORMED) if none are usable."""
    result = llm.generate(QUIZ_PROMPT.format(topic=topic, count=count, difficulty=difficulty),
                          system_instruction=_SYSTEM, json_mode=True, temperature=0.5, max_output_tokens=6144)
    questions = [q for q in (normalize_quiz_question(r) for r in parse_json_array(result.text)) if q]
    if not questions:
        raise llm.LLMError(llm.MALFORMED)
    return questions[:count]


def generate_commit_message(diff_text: str) -> str:
    """One-line commit message for a note diff. A generic message is a safe default here (not AI analysis)."""
    prompt = (
        "Summarize the changes in this note diff as a single commit-message line (max 72 characters) "
        "starting with a verb such as Added, Updated or Fixed. Return only the line, no quotes or markdown.\n\n"
        f"{diff_text}"
    )
    try:
        line = llm.generate(prompt, max_output_tokens=60).text.strip().splitlines()[0]
        return line.replace('"', "").replace("'", "")[:72] or "Updated note content"
    except (llm.LLMError, IndexError):
        return "Updated note content"
