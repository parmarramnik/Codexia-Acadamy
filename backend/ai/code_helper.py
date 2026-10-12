"""
Code helper — AI debugging and progressive hints.

Failures raise ai.llm.LLMError (HTTP 502/503/504 at the route); there are no canned fallbacks
pretending to be an analysis of the student's code.
"""

from ai import llm
from ai.code_review import debug_code  # noqa: F401  (re-exported for routes)

_HINT_DETAIL = {
    1: "Give a very subtle hint without revealing the algorithm. Just point in the right direction.",
    2: "Give a moderate hint that suggests the approach or data structure to use.",
    3: "Give a detailed hint that explains the algorithm step by step, but do not write the full code.",
}


def generate_hints(problem_description: str, user_code: str, language: str, hint_level: int = 1) -> str:
    """Progressive hint for a coding problem. hint_level: 1 subtle, 2 moderate, 3 detailed."""
    prompt = (
        f"Problem:\n{problem_description}\n\nStudent's current code ({language}):\n```{language}\n{user_code}\n```\n\n"
        f"{_HINT_DETAIL.get(hint_level, _HINT_DETAIL[1])}\nBe encouraging and educational."
    )
    return llm.generate(
        prompt,
        system_instruction="You are a helpful coding tutor. Use Markdown; put code in fenced blocks.",
        max_output_tokens=1024,
    ).text
