"""
Single entry point for LLM calls (Gemini).

Every failure mode is reported as an LLMError with a `kind` so callers can show an honest error
instead of a canned answer: not_configured, timeout, rate_limited, blocked, empty, provider.
A response cut off by the token limit is returned with truncated=True.
"""

import logging
import time
from dataclasses import dataclass
from typing import Optional

from config import settings

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:  # pragma: no cover
    genai = None
    GEMINI_AVAILABLE = False

logger = logging.getLogger("codexia.llm")

NOT_CONFIGURED = "not_configured"
TIMEOUT = "timeout"
RATE_LIMITED = "rate_limited"
BLOCKED = "blocked"
EMPTY = "empty"
PROVIDER = "provider"
MALFORMED = "malformed"

USER_MESSAGES = {
    NOT_CONFIGURED: "The AI service is not configured on this server.",
    TIMEOUT: "The AI took too long to respond. Please try again.",
    RATE_LIMITED: "The AI service is busy right now. Please try again in a moment.",
    BLOCKED: "The AI could not answer that request. Try rephrasing it.",
    EMPTY: "The AI returned an empty response. Please try again.",
    PROVIDER: "The AI service had a problem. Please try again.",
    MALFORMED: "The AI returned a response in an unexpected format. Please try again.",
}

HTTP_STATUS = {NOT_CONFIGURED: 503, TIMEOUT: 504, RATE_LIMITED: 429, BLOCKED: 422, EMPTY: 502, PROVIDER: 502, MALFORMED: 502}


class LLMError(Exception):
    def __init__(self, kind: str):
        super().__init__(USER_MESSAGES.get(kind, USER_MESSAGES[PROVIDER]))
        self.kind = kind
        self.status_code = HTTP_STATUS.get(kind, 502)


@dataclass
class LLMResult:
    text: str
    tokens_used: int = 0
    truncated: bool = False


def configured() -> bool:
    return bool(GEMINI_AVAILABLE and settings.GEMINI_API_KEY)


def _classify(exc: Exception) -> str:
    name = type(exc).__name__
    if name in ("DeadlineExceeded", "TimeoutError", "ReadTimeout") or isinstance(exc, TimeoutError):
        return TIMEOUT
    if name in ("ResourceExhausted", "TooManyRequests"):
        return RATE_LIMITED
    if name in ("ServiceUnavailable", "InternalServerError", "GatewayTimeout"):
        return PROVIDER
    return PROVIDER


def _extract(response) -> LLMResult:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        feedback = getattr(response, "prompt_feedback", None)
        if feedback is not None and getattr(feedback, "block_reason", None):
            raise LLMError(BLOCKED)
        raise LLMError(EMPTY)
    candidate = candidates[0]
    finish = str(getattr(candidate.finish_reason, "name", candidate.finish_reason) or "")
    if finish in ("SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT"):
        raise LLMError(BLOCKED)
    parts = getattr(getattr(candidate, "content", None), "parts", None) or []
    text = "".join(getattr(p, "text", "") or "" for p in parts).strip()
    if not text:
        raise LLMError(EMPTY)
    usage = getattr(response, "usage_metadata", None)
    tokens = int(getattr(usage, "total_token_count", 0) or 0) if usage is not None else 0
    return LLMResult(text=text, tokens_used=tokens, truncated=finish == "MAX_TOKENS")


def generate(
    prompt: str,
    *,
    system_instruction: Optional[str] = None,
    history: Optional[list[dict]] = None,
    temperature: float = 0.4,
    max_output_tokens: int = 2048,
    json_mode: bool = False,
    timeout: float = 60.0,
    retries: int = 1,
) -> LLMResult:
    """One generation. `history` is [{"role": "user"|"assistant", "content": str}, ...]."""
    if not configured():
        raise LLMError(NOT_CONFIGURED)
    genai.configure(api_key=settings.GEMINI_API_KEY)
    config = {"temperature": temperature, "max_output_tokens": max_output_tokens}
    if json_mode:
        config["response_mime_type"] = "application/json"
    contents = [
        {"role": "user" if m.get("role") == "user" else "model", "parts": [m.get("content", "")]}
        for m in (history or []) if m.get("content")
    ]
    contents.append({"role": "user", "parts": [prompt]})

    attempt = 0
    while True:
        try:
            model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL, system_instruction=system_instruction,
                                          generation_config=config)
            response = model.generate_content(contents, request_options={"timeout": timeout})
            return _extract(response)
        except LLMError as err:
            if err.kind == EMPTY and attempt < retries:  # transient empty completions are common; retry once
                attempt += 1
                continue
            raise
        except Exception as exc:  # noqa: BLE001 - provider SDK raises many types
            kind = _classify(exc)
            logger.warning("LLM call failed (%s): %s", kind, type(exc).__name__)
            if kind in (TIMEOUT, RATE_LIMITED, PROVIDER) and attempt < retries:
                attempt += 1
                time.sleep(1.0 * attempt)
                continue
            raise LLMError(kind) from exc
