"""Code execution: language mapping, request validation, Judge0 parsing, timeouts, provider failures."""
import base64
import json

import httpx
import pytest

from config import settings
from services import code_runner as cr


def b64(text):
    return base64.b64encode(text.encode()).decode()


@pytest.fixture(autouse=True)
def judge0_settings(monkeypatch):
    monkeypatch.setattr(settings, "CODE_EXEC_PROVIDER", "judge0")
    monkeypatch.setattr(settings, "JUDGE0_URL", "https://judge0.test")
    monkeypatch.setattr(settings, "JUDGE0_API_KEY", "secret-token")
    monkeypatch.setattr(settings, "JUDGE0_LANGUAGE_IDS", None)


def fake_judge0(monkeypatch, handler):
    transport = httpx.MockTransport(handler)
    real = httpx.Client
    monkeypatch.setattr(cr.httpx, "Client", lambda **kw: real(transport=transport, **kw))


# ---- language mapping -------------------------------------------------------------------------

@pytest.mark.parametrize("alias,expected", [("py", "python"), ("Python3", "python"), ("js", "javascript"),
                                            ("node", "javascript"), ("C++", "cpp"), ("golang", "go"),
                                            ("java", "java")])
def test_language_aliases(alias, expected):
    assert cr.normalize_language(alias) == expected


def test_every_advertised_language_has_a_judge0_id():
    ids = cr.judge0_language_ids()
    assert set(cr.supported_languages()) == {"python", "javascript", "cpp", "c", "java", "go"}
    assert all(isinstance(ids[lang], int) for lang in cr.supported_languages())


def test_language_id_override(monkeypatch):
    monkeypatch.setattr(settings, "JUDGE0_LANGUAGE_IDS", '{"python": 71}')
    assert cr.judge0_language_ids()["python"] == 71


def test_unsupported_language_rejected():
    with pytest.raises(cr.InvalidRunRequest):
        cr.run_program("print(1)", "brainfuck")


# ---- request validation -----------------------------------------------------------------------

def test_empty_and_oversized_requests_rejected():
    with pytest.raises(cr.InvalidRunRequest):
        cr.run_program("   ", "python")
    with pytest.raises(cr.InvalidRunRequest):
        cr.run_program("x" * (settings.CODE_EXEC_MAX_SOURCE_BYTES + 1), "python")
    with pytest.raises(cr.InvalidRunRequest):
        cr.run_program("print(1)", "python", "i" * (settings.CODE_EXEC_MAX_STDIN_BYTES + 1))


def test_java_public_class_is_renamed_to_main():
    src = ("public class Solution {\n  public static void main(String[] a){ "
           "System.out.println(new Solution().x()); }\n  int x(){return 1;} }")
    out = cr.prepare_source("java", src)
    assert "public class Main" in out and "new Main()" in out and "Solution" not in out
    assert cr.prepare_source("java", "public class Main {}") == "public class Main {}"


def test_go_gets_package_main():
    assert cr.prepare_source("go", "func main(){}").startswith("package main")


# ---- output parsing ---------------------------------------------------------------------------

def test_parse_accepted():
    r = cr.parse_judge0_result({"status": {"id": 3}, "stdout": b64("hi\n"), "time": "0.012",
                                "memory": 2048, "exit_code": 0})
    assert r.ok and r.stdout == "hi\n" and r.memory_mb == 2.0 and round(r.time_ms) == 12


def test_parse_compile_error():
    r = cr.parse_judge0_result({"status": {"id": 6}, "compile_output": b64("main.c:1: error: boom")})
    assert r.status == cr.COMPILE_ERROR and r.error_text.startswith("Compilation Error:") and "boom" in r.error_text


def test_parse_runtime_error_keeps_partial_stdout():
    r = cr.parse_judge0_result({"status": {"id": 11}, "stdout": b64("partial"),
                                "stderr": b64("Traceback...\nValueError"), "exit_code": 1})
    assert r.status == cr.RUNTIME_ERROR and r.stdout == "partial" and "ValueError" in r.error_text


def test_parse_timeout():
    r = cr.parse_judge0_result({"status": {"id": 5}})
    assert r.status == cr.TIMEOUT and r.error_text == "Time Limit Exceeded"


def test_parse_internal_error_is_unavailable_not_a_student_failure():
    with pytest.raises(cr.CodeExecutionUnavailable):
        cr.parse_judge0_result({"status": {"id": 13}})


def test_output_is_truncated(monkeypatch):
    monkeypatch.setattr(settings, "CODE_EXEC_MAX_OUTPUT_BYTES", 10)
    r = cr.parse_judge0_result({"status": {"id": 3}, "stdout": b64("x" * 100)})
    assert r.stdout.startswith("x" * 10) and "truncated" in r.stdout


# ---- Judge0 round trip, polling, failures -----------------------------------------------------

def test_full_round_trip_sends_stdin_and_limits_and_keeps_token_out_of_body(monkeypatch):
    seen = {"polls": 0}

    def handler(request: httpx.Request):
        if request.method == "POST":
            seen["body"] = json.loads(request.content)
            seen["auth"] = request.headers.get("X-Auth-Token")
            return httpx.Response(201, json={"token": "t1"})
        seen["polls"] += 1
        if seen["polls"] == 1:
            return httpx.Response(200, json={"status": {"id": 2}})
        return httpx.Response(200, json={"status": {"id": 3}, "stdout": b64("42\n")})

    fake_judge0(monkeypatch, handler)
    r = cr.run_program("print(int(input())*2)", "python", "21\n", time_limit_seconds=2, memory_limit_mb=128)
    assert r.ok and r.stdout == "42\n"
    body = seen["body"]
    assert base64.b64decode(body["stdin"]) == b"21\n"
    assert body["language_id"] == cr.judge0_language_ids()["python"]
    assert body["cpu_time_limit"] == 2 and body["memory_limit"] == 128 * 1024 and body["enable_network"] is False
    assert seen["auth"] == "secret-token" and "secret-token" not in str(body)


def test_empty_stdin_is_sent_as_empty(monkeypatch):
    seen = {}

    def handler(request):
        if request.method == "POST":
            seen["stdin"] = json.loads(request.content)["stdin"]
            return httpx.Response(201, json={"token": "t"})
        return httpx.Response(200, json={"status": {"id": 3}, "stdout": ""})

    fake_judge0(monkeypatch, handler)
    assert cr.run_program("print(1)", "python", "").ok
    assert seen["stdin"] == ""


@pytest.mark.parametrize("code", [429, 500, 502, 503])
def test_provider_errors_become_unavailable(monkeypatch, code):
    fake_judge0(monkeypatch, lambda request: httpx.Response(code, text="nope"))
    with pytest.raises(cr.CodeExecutionUnavailable):
        cr.run_program("print(1)", "python")


def test_rejected_credentials_do_not_leak(monkeypatch):
    fake_judge0(monkeypatch, lambda request: httpx.Response(401, text="bad token secret-token"))
    with pytest.raises(cr.CodeExecutionUnavailable) as err:
        cr.run_program("print(1)", "python")
    assert "secret-token" not in str(err.value)


def test_network_timeout_becomes_unavailable(monkeypatch):
    def handler(request):
        raise httpx.ConnectTimeout("slow")

    fake_judge0(monkeypatch, handler)
    with pytest.raises(cr.CodeExecutionUnavailable):
        cr.run_program("print(1)", "python")


def test_never_finishing_job_gives_up(monkeypatch):
    monkeypatch.setattr(settings, "CODE_EXEC_HTTP_TIMEOUT_SECONDS", 0.2)

    def handler(request):
        if request.method == "POST":
            return httpx.Response(201, json={"token": "t"})
        return httpx.Response(200, json={"status": {"id": 2}})

    fake_judge0(monkeypatch, handler)
    with pytest.raises(cr.CodeExecutionUnavailable):
        cr.run_program("while True: pass", "python")


# ---- provider selection / production safety ---------------------------------------------------

def test_local_runner_refused_in_production(monkeypatch):
    monkeypatch.setattr(settings, "CODE_EXEC_PROVIDER", "local")
    monkeypatch.setattr(settings, "DEBUG", False)
    with pytest.raises(cr.CodeExecutionUnavailable):
        cr.run_program("print(1)", "python")


def test_unconfigured_production_is_unavailable_not_local(monkeypatch):
    monkeypatch.setattr(settings, "CODE_EXEC_PROVIDER", "auto")
    monkeypatch.setattr(settings, "JUDGE0_URL", None)
    monkeypatch.setattr(settings, "DEBUG", False)
    with pytest.raises(cr.CodeExecutionUnavailable):
        cr.run_program("print(1)", "python")


def test_local_runner_scrubs_secrets(monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "super-secret")
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@h/db")
    env = cr._scrubbed_env()
    assert "RAZORPAY_KEY_SECRET" not in env and "DATABASE_URL" not in env


def test_local_runner_in_debug_runs_python_and_reports_errors_and_timeouts(monkeypatch):
    monkeypatch.setattr(settings, "CODE_EXEC_PROVIDER", "local")
    monkeypatch.setattr(settings, "DEBUG", True)
    ok = cr.run_program("print(int(input())+1)", "python", "41\n")
    assert ok.ok and ok.stdout.strip() == "42"
    syntax = cr.run_program("def (:", "python")
    assert syntax.status == cr.RUNTIME_ERROR and "SyntaxError" in syntax.error_text
    boom = cr.run_program("raise ValueError('x')", "python")
    assert boom.status == cr.RUNTIME_ERROR and "ValueError" in boom.error_text
    slow = cr.run_program("while True: pass", "python", time_limit_seconds=1)
    assert slow.status == cr.TIMEOUT
    assert cr.run_program("print('hi')", "python", "").stdout.strip() == "hi"


def test_user_run_guard_blocks_second_run():
    with cr.user_run_guard(7):
        with pytest.raises(cr.RunBusy):
            with cr.user_run_guard(7):
                pass
    with cr.user_run_guard(7):  # released afterwards
        pass
