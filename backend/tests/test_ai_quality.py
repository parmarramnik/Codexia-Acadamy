"""AI response handling: LLM failure modes, code-review validation, no fabricated reviews."""
import json
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ai import code_review, llm
from auth.jwt_handler import create_access_token
from database import Base, get_db
from main import app
from models.user import User, UserRole
from prompts.tutor_prompts import build_system_prompt

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def response(text="hi", finish="STOP", tokens=5, candidates=True, block=None):
    if not candidates:
        return NS(candidates=[], prompt_feedback=NS(block_reason=block), usage_metadata=None)
    cand = NS(finish_reason=NS(name=finish), content=NS(parts=[NS(text=text)] if text is not None else []))
    return NS(candidates=[cand], usage_metadata=NS(total_token_count=tokens), prompt_feedback=None)


# ---- LLM wrapper ------------------------------------------------------------------------------

def test_extract_normal_truncated_empty_blocked():
    ok = llm._extract(response("Hello"))
    assert ok.text == "Hello" and ok.tokens_used == 5 and not ok.truncated
    assert llm._extract(response("cut off", finish="MAX_TOKENS")).truncated is True
    with pytest.raises(llm.LLMError) as e:
        llm._extract(response(""))
    assert e.value.kind == llm.EMPTY
    with pytest.raises(llm.LLMError) as e:
        llm._extract(response("x", finish="SAFETY"))
    assert e.value.kind == llm.BLOCKED
    with pytest.raises(llm.LLMError) as e:
        llm._extract(response(candidates=False, block="SAFETY"))
    assert e.value.kind == llm.BLOCKED
    with pytest.raises(llm.LLMError) as e:
        llm._extract(response(candidates=False))
    assert e.value.kind == llm.EMPTY


def test_not_configured_is_an_error_not_a_canned_answer(monkeypatch):
    monkeypatch.setattr(llm.settings, "GEMINI_API_KEY", None)
    with pytest.raises(llm.LLMError) as e:
        llm.generate("hello")
    assert e.value.kind == llm.NOT_CONFIGURED and e.value.status_code == 503


def test_provider_exceptions_are_classified_and_retried(monkeypatch):
    monkeypatch.setattr(llm.settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)
    calls = []

    class DeadlineExceeded(Exception):
        pass

    class Model:
        def __init__(self, **kw): pass
        def generate_content(self, contents, request_options=None):
            calls.append(request_options)
            raise DeadlineExceeded("slow")

    monkeypatch.setattr(llm, "genai", NS(configure=lambda **kw: None, GenerativeModel=Model))
    with pytest.raises(llm.LLMError) as e:
        llm.generate("hello", timeout=5)
    assert e.value.kind == llm.TIMEOUT and e.value.status_code == 504
    assert len(calls) == 2 and calls[0] == {"timeout": 5}  # one retry, timeout passed to the provider


# ---- prompt rules -----------------------------------------------------------------------------

def test_system_prompt_states_markdown_math_and_currency_conventions():
    prompt = build_system_prompt(None)
    assert "\\$5" in prompt and "single dollar signs" in prompt and "fenced" in prompt
    assert "COURSE MATERIAL RULES" not in prompt
    assert "[S1]" in build_system_prompt(True) and "no relevant course material" in build_system_prompt(False)


# ---- code review validation -------------------------------------------------------------------

CODE = "def f(xs):\n    total = 0\n    for x in xs:\n        total += x\n    return total\n"


def test_findings_are_validated_against_the_submitted_code():
    review = code_review.normalize_review({
        "summary": "Fine.", "quality_score": 140, "findings": [
            {"category": "bug", "kind": "issue", "severity": "high", "title": "Off by one", "detail": "d", "line": 3},
            {"category": "weird", "kind": "suggestion", "severity": "extreme", "title": "Rename", "line": 999},
            {"category": "security", "title": "", "detail": ""},      # empty -> dropped
            "not a dict",
        ], "corrected_code": CODE}, CODE)
    assert review["quality_score"] == 100
    assert len(review["findings"]) == 2
    first, second = review["findings"]
    assert first["line"] == 3 and first["kind"] == "issue" and first["severity"] == "high"
    assert second["line"] is None and second["category"] == "maintainability" and second["severity"] == "info"
    assert review["corrected_code"] is None          # identical to the input is not a "correction"
    assert review["bugs"] == ["Off by one (line 3)"] and review["optimization_tips"] == ["Rename"]


def test_no_findings_stays_empty():
    review = code_review.normalize_review({"summary": "Looks correct.", "findings": [], "recommendations": []}, CODE)
    assert review["findings"] == [] and review["bugs"] == [] and review["quality_score"] is None


@pytest.mark.parametrize("text", ["not json", "[1,2,3]", "", "```json\n{broken\n```"])
def test_unparseable_output_is_malformed(text):
    with pytest.raises(llm.LLMError) as e:
        code_review.parse_json_object(text)
    assert e.value.kind == llm.MALFORMED


def test_parse_accepts_fenced_and_chatty_json():
    assert code_review.parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert code_review.parse_json_object('Here you go: {"a": 2} hope it helps') == {"a": 2}


def test_review_sends_the_actual_code_with_line_numbers(monkeypatch):
    seen = {}

    def fake(prompt, **kw):
        seen["prompt"], seen["kw"] = prompt, kw
        return llm.LLMResult(text=json.dumps({"summary": "ok", "findings": []}))

    monkeypatch.setattr(llm, "generate", fake)
    code_review.review_code(CODE, "python", "Sum list")
    assert "   3 |     for x in xs:" in seen["prompt"] and "Sum list" in seen["prompt"]
    assert seen["kw"]["json_mode"] is True


def test_truncated_review_is_an_error_not_a_partial_review(monkeypatch):
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(text='{"summary": "cu', truncated=True))
    with pytest.raises(llm.LLMError) as e:
        code_review.review_code(CODE, "python")
    assert e.value.kind == llm.MALFORMED


def test_debug_requires_an_explanation(monkeypatch):
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(text='{"fixed_code": "x"}'))
    with pytest.raises(llm.LLMError):
        code_review.debug_code(CODE, "python")
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(
        text=json.dumps({"explanation": "Looks right.", "fixed_code": CODE, "suggestions": ["Add tests"]})))
    result = code_review.debug_code(CODE, "python")
    assert result["fixed_code"] is None and result["suggestions"] == ["Add tests"]


# ---- HTTP: no fabricated review on failure ----------------------------------------------------

@pytest.fixture
def client():
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    db = Session()
    user = User(email="a@x.io", username="a", password_hash="x", full_name="A", role=UserRole.STUDENT, is_verified=True)
    db.add(user)
    db.commit()

    def override():
        yield db
    app.dependency_overrides[get_db] = override
    c = TestClient(app, raise_server_exceptions=True)
    c.headers.update({"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"})
    yield c
    app.dependency_overrides.clear()
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_review_endpoint_returns_error_instead_of_canned_review(client, monkeypatch):
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(text="Sorry, I can't format that."))
    res = client.post("/api/ai/coding/review", json={"code": CODE, "language": "python"})
    assert res.status_code == 502 and "quality_score" not in res.text and "85" not in res.text


def test_review_endpoint_happy_path_and_limits(client, monkeypatch):
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(text=json.dumps({
        "summary": "Good.", "quality_score": 90, "time_complexity": "O(n)",
        "findings": [{"category": "performance", "kind": "suggestion", "severity": "low", "title": "Use sum()", "line": 2}]})))
    res = client.post("/api/ai/coding/review", json={"code": CODE, "language": "python"})
    body = res.json()
    assert res.status_code == 200 and body["findings"][0]["line"] == 2 and body["time_complexity"] == "O(n)"
    assert client.post("/api/ai/coding/review", json={"code": "x" * 60000, "language": "python"}).status_code == 422


def test_debug_endpoint_failure_is_not_disguised(client, monkeypatch):
    def fail(p, **kw):
        raise llm.LLMError(llm.TIMEOUT)
    monkeypatch.setattr(llm, "generate", fail)
    res = client.post("/api/ai/debug", json={"code": CODE, "language": "python"})
    assert res.status_code == 504 and "fixed_code" not in res.text


# ---- generators: validated, never canned ------------------------------------------------------

def test_quiz_question_uses_the_models_correct_index_and_only_that_one():
    from ai.generator import normalize_quiz_question
    q = normalize_quiz_question({"question": "2+2?", "options": ["3", "4", "5", "6"], "correct_index": 1})
    assert q["correct_answer"] == "4" and q["correct_index"] == 1
    assert normalize_quiz_question({"question": "x", "options": ["a", "b"], "correct_answer": "B"})["correct_answer"] == "b"
    assert normalize_quiz_question({"question": "x", "options": ["a", "b"], "correct_answer": "b"})["correct_answer"] == "b"
    # Unusable questions are dropped, not "fixed" by guessing option A.
    assert normalize_quiz_question({"question": "x", "options": ["a", "b"]}) is None
    assert normalize_quiz_question({"question": "x", "options": ["a"], "correct_index": 0}) is None
    assert normalize_quiz_question({"question": "x", "options": ["a", "b"], "correct_index": 9}) is None


def test_generate_quiz_flashcards_and_failures(monkeypatch):
    from ai import generator
    quiz = json.dumps([{"question": "Q1", "options": ["a", "b", "c", "d"], "correct_index": 2, "explanation": "e"},
                       {"question": "bad", "options": ["only"]}])
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(text=quiz))
    questions = generator.generate_quiz_questions("t", 5)
    assert len(questions) == 1 and questions[0]["correct_answer"] == "c"

    cards = json.dumps({"flashcards": [{"question": "Q", "answer": "A"}, {"question": "", "answer": "x"}]})
    monkeypatch.setattr(llm, "generate", lambda p, **kw: llm.LLMResult(text=cards))
    assert generator.generate_flashcards("t", 5) == [{"question": "Q", "answer": "A"}]

    for text in ("garbage", "[]", json.dumps([{"question": "", "answer": ""}])):
        monkeypatch.setattr(llm, "generate", lambda p, text=text, **kw: llm.LLMResult(text=text))
        with pytest.raises(llm.LLMError):
            generator.generate_flashcards("t", 3)
        with pytest.raises(llm.LLMError):
            generator.generate_quiz_questions("t", 3)

    def down(p, **kw):
        raise llm.LLMError(llm.NOT_CONFIGURED)
    monkeypatch.setattr(llm, "generate", down)
    with pytest.raises(llm.LLMError):  # no "AI unavailable" flashcard that would be saved as real content
        generator.generate_flashcards("t", 3)
    with pytest.raises(llm.LLMError):
        generator.generate_notes("t")
    assert generator.generate_commit_message("diff") == "Updated note content"  # harmless default, not an analysis
