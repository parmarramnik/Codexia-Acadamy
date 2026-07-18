"""
Code helper — AI-powered debugging and hint generation.
Gracefully degrades if google-generativeai is not installed.
"""

from typing import Optional, List

from config import settings

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def initialize_gemini():
    """Initialize the Gemini API client."""
    if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)


def debug_code(
    code: str,
    language: str,
    error_message: Optional[str] = None,
) -> dict:
    """
    Analyze code for bugs and provide fixes.
    Returns explanation, fixed code, and suggestions.
    """
    if not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
        return {
            "explanation": "AI debugging is currently unavailable. Please configure GEMINI_API_KEY.",
            "fixed_code": None,
            "suggestions": ["Configure the GEMINI_API_KEY environment variable to enable AI features."],
        }

    initialize_gemini()

    prompt = f"""You are an expert {language} programmer and debugger.

Analyze the following {language} code and help the user fix it.

Code:
```{language}
{code}
```
"""
    if error_message:
        prompt += f"\nError message: {error_message}\n"

    prompt += """
Respond in the following JSON format:
{{
    "explanation": "Clear explanation of the bug(s)",
    "fixed_code": "The corrected code",
    "suggestions": ["suggestion 1", "suggestion 2"]
}}
"""

    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        response = model.generate_content(prompt)

        import json
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except Exception as error:
        print(f"[AI Error] debug_code failed: {str(error)}")
        return {
            "explanation": "Let's review the code logic: ensure variables are initialized correctly, check array boundaries in loops, and verify return types match.",
            "fixed_code": code,
            "suggestions": ["Verify syntax correctness.", "Double-check loop condition bounds."],
        }


def generate_hints(
    problem_description: str,
    user_code: str,
    language: str,
    hint_level: int = 1,
) -> str:
    """
    Generate progressive hints for a coding problem.
    hint_level: 1 = subtle, 2 = moderate, 3 = detailed
    """
    if not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
        return "AI hints are currently unavailable. Please configure GEMINI_API_KEY."

    initialize_gemini()

    hint_detail = {
        1: "Give a very subtle hint without revealing the algorithm. Just point in the right direction.",
        2: "Give a moderate hint that suggests the approach or data structure to use.",
        3: "Give a detailed hint that explains the algorithm step by step, but do not write the full code.",
    }

    prompt = f"""You are a helpful coding tutor.

Problem: {problem_description}

Student's current code ({language}):
```{language}
{user_code}
```

{hint_detail.get(hint_level, hint_detail[1])}

Be encouraging and educational in your hint."""

    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text
    except Exception as error:
        print(f"[AI Error] generate_hints failed: {str(error)}")
        return "Hint: Check edge cases where inputs are empty, verify loop boundary indexes, and ensure all variables are declared."
