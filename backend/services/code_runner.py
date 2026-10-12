"""
Isolated code execution.

Student code is untrusted. It never runs inside the API process on the production host:
production uses a Judge0 CE service (its own sandbox with CPU, memory, process, output and
network limits). A scrubbed-environment subprocess runner exists for local development only
and refuses to start unless DEBUG=true.

Public API:
    run_program(code, language, stdin, time_limit_seconds, memory_limit_mb) -> RunResult
    supported_languages() -> list[str]
    user_run_guard(user_id)   # one in-flight run per user
"""

import base64
import contextlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger("codexia.code_runner")

# Normalised outcome of one run.
OK = "ok"
COMPILE_ERROR = "compile_error"
RUNTIME_ERROR = "runtime_error"
TIMEOUT = "timeout"
UNAVAILABLE = "unavailable"


class CodeExecutionUnavailable(Exception):
    """The execution backend is missing, down, rate limited or misconfigured (HTTP 503)."""


class InvalidRunRequest(ValueError):
    """The request itself is invalid: unknown language, empty or oversized code/stdin (HTTP 422)."""


class RunBusy(Exception):
    """The user already has a run in flight, or the server is at its concurrency limit (HTTP 429)."""


@dataclass
class RunResult:
    status: str
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    exit_code: Optional[int] = None
    time_ms: float = 0.0
    memory_mb: float = 0.0
    message: str = ""

    @property
    def ok(self) -> bool:
        return self.status == OK

    @property
    def error_text(self) -> Optional[str]:
        """Single user-facing error string (None when the run succeeded)."""
        if self.status == OK:
            return None
        if self.status == COMPILE_ERROR:
            return f"Compilation Error:\n{self.compile_output or self.stderr or self.message}".rstrip()
        if self.status == TIMEOUT:
            return "Time Limit Exceeded"
        text = (self.stderr or self.message or "").strip()
        return text or f"Runtime Error (exit code {self.exit_code})"


# --------------------------------------------------------------------------- languages

# Languages the UI advertises. Judge0 CE 1.13.x ids; override per deployment with JUDGE0_LANGUAGE_IDS.
DEFAULT_JUDGE0_IDS = {
    "python": 100,      # Python 3.12.5
    "javascript": 102,  # Node.js 22.08.0
    "cpp": 105,         # C++ (GCC 14.1.0)
    "c": 103,           # C (GCC 14.1.0)
    "java": 91,         # Java (JDK 17.0.6)
    "go": 107,          # Go 1.22.0
}

ALIASES = {
    "python": "python", "py": "python", "python3": "python",
    "javascript": "javascript", "js": "javascript", "node": "javascript", "nodejs": "javascript",
    "cpp": "cpp", "c++": "cpp",
    "c": "c",
    "java": "java",
    "go": "go", "golang": "go",
}


def normalize_language(language: Optional[str]) -> str:
    key = (language or "").lower().strip()
    if key not in ALIASES:
        raise InvalidRunRequest(f"Unsupported programming language: {language}")
    return ALIASES[key]


def judge0_language_ids() -> dict[str, int]:
    ids = dict(DEFAULT_JUDGE0_IDS)
    if settings.JUDGE0_LANGUAGE_IDS:
        try:
            override = json.loads(settings.JUDGE0_LANGUAGE_IDS)
            ids.update({normalize_language(k): int(v) for k, v in override.items()})
        except (ValueError, TypeError, InvalidRunRequest):
            logger.error("JUDGE0_LANGUAGE_IDS is not valid JSON of {language: id}; using defaults")
    return ids


def supported_languages() -> list[str]:
    return list(DEFAULT_JUDGE0_IDS)


# --------------------------------------------------------------------------- source preparation

_PY_ARG_PARSER = """
    def _parse_val(s):
        s = s.strip()
        if not s: return None
        try: return ast.literal_eval(s)
        except: pass
        if s.replace('-', '', 1).isdigit(): return int(s)
        return s

    _raw = sys.stdin.read().strip()
    _lines = [l.strip() for l in _raw.splitlines() if l.strip()]
    _args = [_parse_val(l) for l in _lines]
"""

_PY_SOLUTION_WRAPPER = "\n\nif __name__ == '__main__':\n    import sys\n    import ast\n" + _PY_ARG_PARSER + """    _sol = Solution()
    _methods = [m for m in dir(_sol) if not m.startswith('_') and callable(getattr(_sol, m))]
    if _methods:
        try:
            _res = getattr(_sol, _methods[0])(*_args)
            if isinstance(_res, (list, tuple)):
                print(" ".join(map(str, _res)))
            elif _res is not None:
                print(_res)
        except Exception as _e:
            import traceback
            traceback.print_exc()
"""

_PY_SOLVE_WRAPPER = "\n\nif __name__ == '__main__':\n    import sys\n    import ast\n" + _PY_ARG_PARSER + """    try:
        _res = solve(*_args)
        if isinstance(_res, (list, tuple)):
            print(" ".join(map(str, _res)))
        elif _res is not None:
            print(_res)
    except Exception as _e:
        import traceback
        traceback.print_exc()
"""

_JS_SOLVE_WRAPPER = """

const fs = require('fs');
const _input = fs.readFileSync(0, 'utf-8').trim();
const _lines = _input.split('\\n').map(l => l.trim()).filter(l => l !== '');
const _args = _lines.map(l => {
    try { return JSON.parse(l); } catch(e) {}
    if (!isNaN(l) && l !== '') return Number(l);
    return l;
});
try {
    const _res = solve(..._args);
    if (Array.isArray(_res)) {
        console.log(_res.join(' '));
    } else if (_res !== undefined) {
        console.log(_res);
    }
} catch (e) {
    console.error(e);
}
"""


def prepare_source(language: str, code: str) -> str:
    """Add the LeetCode-style stdin harness for `class Solution` / `solve()` submissions (as before)."""
    if language == "python":
        reads_stdin = "if __name__" in code or "sys.stdin" in code or "input(" in code
        if "class Solution" in code and not reads_stdin:
            return code + _PY_SOLUTION_WRAPPER
        if "def solve(" in code and not reads_stdin:
            return code + _PY_SOLVE_WRAPPER
    elif language == "javascript":
        if "function solve(" in code and "require('fs')" not in code and "process.stdin" not in code:
            return code + _JS_SOLVE_WRAPPER
    elif language == "go":
        if "package " not in code:
            return "package main\n\n" + code
    elif language == "java":
        return _rename_public_class_to_main(code)
    return code


_JAVA_PUBLIC_CLASS_RE = re.compile(r"^\s*public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_$][\w$]*)", re.M)


def _rename_public_class_to_main(code: str) -> str:
    """Judge0 compiles Java as Main.java, so the public class must be called Main."""
    match = _JAVA_PUBLIC_CLASS_RE.search(code)
    if not match or match.group(1) == "Main":
        return code
    name = re.escape(match.group(1))
    return re.sub(rf"(?<![\w$]){name}(?![\w$])", "Main", code)


def validate_request(code: str, language: str, stdin: str) -> str:
    lang = normalize_language(language)
    if not code or not code.strip():
        raise InvalidRunRequest("Source code is empty")
    if len(code.encode("utf-8")) > settings.CODE_EXEC_MAX_SOURCE_BYTES:
        raise InvalidRunRequest("Source code is too large")
    if len((stdin or "").encode("utf-8")) > settings.CODE_EXEC_MAX_STDIN_BYTES:
        raise InvalidRunRequest("Input is too large")
    return lang


def _clip(text: Optional[str]) -> str:
    text = (text or "").replace("\r\n", "\n")
    limit = settings.CODE_EXEC_MAX_OUTPUT_BYTES
    raw = text.encode("utf-8", "replace")
    if len(raw) <= limit:
        return text
    return raw[:limit].decode("utf-8", "ignore") + "\n…[output truncated]"


# --------------------------------------------------------------------------- Judge0 provider

# https://ce.judge0.com — status ids
_J0_PROCESSING = {1, 2}
_J0_TIMEOUT = 5
_J0_COMPILE_ERROR = 6
_J0_INTERNAL_ERROR = 13


def _b64(text: str) -> str:
    return base64.b64encode((text or "").encode("utf-8")).decode("ascii")


def _unb64(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return base64.b64decode(value).decode("utf-8", "replace")
    except (ValueError, TypeError):
        return ""


def _judge0_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if settings.JUDGE0_API_KEY:
        headers[settings.JUDGE0_AUTH_HEADER] = settings.JUDGE0_API_KEY
    if settings.JUDGE0_RAPIDAPI_HOST:
        headers["X-RapidAPI-Host"] = settings.JUDGE0_RAPIDAPI_HOST
    return headers


def parse_judge0_result(data: dict) -> RunResult:
    """Map a Judge0 submission object (base64 fields) onto a RunResult."""
    status = data.get("status") or {}
    status_id = int(status.get("id") or 0)
    stdout = _clip(_unb64(data.get("stdout")))
    stderr = _clip(_unb64(data.get("stderr")))
    compile_output = _clip(_unb64(data.get("compile_output")))
    message = _unb64(data.get("message")) or str(status.get("description") or "")
    try:
        time_ms = float(data.get("time") or 0) * 1000
    except (TypeError, ValueError):
        time_ms = 0.0
    try:
        memory_mb = float(data.get("memory") or 0) / 1024
    except (TypeError, ValueError):
        memory_mb = 0.0
    common = dict(stdout=stdout, stderr=stderr, compile_output=compile_output,
                  exit_code=data.get("exit_code"), time_ms=time_ms, memory_mb=memory_mb, message=message)

    if status_id == 3:
        return RunResult(status=OK, **common)
    if status_id == _J0_COMPILE_ERROR:
        return RunResult(status=COMPILE_ERROR, **common)
    if status_id == _J0_TIMEOUT:
        return RunResult(status=TIMEOUT, **common)
    if status_id == _J0_INTERNAL_ERROR or status_id == 0:
        raise CodeExecutionUnavailable("The code execution service reported an internal error. Please try again.")
    # 7-12 runtime errors (SIGSEGV, SIGFPE, NZEC, …) and 14 exec format error
    if not stderr:
        common["stderr"] = message
    return RunResult(status=RUNTIME_ERROR, **common)


def _run_judge0(lang: str, source: str, stdin: str, time_limit: float, memory_mb: int) -> RunResult:
    base = (settings.JUDGE0_URL or "").rstrip("/")
    ids = judge0_language_ids()
    payload = {
        "source_code": _b64(source),
        "language_id": ids[lang],
        "stdin": _b64(stdin or ""),
        "cpu_time_limit": time_limit,
        "wall_time_limit": min(time_limit * 3, settings.CODE_EXEC_MAX_TIME_SECONDS * 3),
        "memory_limit": int(memory_mb * 1024),
        "max_file_size": 1024,
        "enable_network": False,
    }
    params = {"base64_encoded": "true", "wait": "false"}
    deadline = time.monotonic() + settings.CODE_EXEC_HTTP_TIMEOUT_SECONDS
    try:
        with httpx.Client(timeout=settings.CODE_EXEC_HTTP_TIMEOUT_SECONDS, headers=_judge0_headers()) as client:
            created = client.post(f"{base}/submissions", params=params, json=payload)
            _raise_for_provider_status(created)
            token = created.json().get("token")
            if not token:
                raise CodeExecutionUnavailable("The code execution service returned an unexpected response.")
            delay = 0.3
            while True:
                fetched = client.get(
                    f"{base}/submissions/{token}",
                    params={"base64_encoded": "true",
                            "fields": "status,stdout,stderr,compile_output,message,time,memory,exit_code"},
                )
                _raise_for_provider_status(fetched)
                data = fetched.json()
                if int((data.get("status") or {}).get("id") or 0) not in _J0_PROCESSING:
                    return parse_judge0_result(data)
                if time.monotonic() > deadline:
                    raise CodeExecutionUnavailable("The code execution service took too long to respond.")
                time.sleep(delay)
                delay = min(delay * 1.5, 1.5)
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        logger.warning("Judge0 unreachable: %s", type(exc).__name__)
        raise CodeExecutionUnavailable("The code execution service is unreachable. Please try again shortly.")
    except ValueError:  # malformed JSON body
        raise CodeExecutionUnavailable("The code execution service returned an unreadable response.")


def _raise_for_provider_status(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    if response.status_code == 429:
        raise CodeExecutionUnavailable("The code execution service is rate limited. Please try again in a moment.")
    if response.status_code in (401, 403):
        logger.error("Judge0 rejected our credentials (HTTP %s)", response.status_code)
        raise CodeExecutionUnavailable("Code execution is misconfigured. Please contact support.")
    if response.status_code == 422:
        logger.error("Judge0 rejected the submission parameters: %s", response.text[:300])
        raise CodeExecutionUnavailable("The code execution service rejected the request limits.")
    logger.error("Judge0 error HTTP %s", response.status_code)
    raise CodeExecutionUnavailable("The code execution service is temporarily unavailable.")


# --------------------------------------------------------------------------- local (development only)

_LOCAL_ENV_KEEP = ("PATH", "SYSTEMROOT", "TEMP", "TMP", "HOME", "LANG", "JAVA_HOME", "GOROOT", "GOCACHE", "GOPATH")


def _scrubbed_env() -> dict:
    """Never hand application secrets (DATABASE_URL, RAZORPAY_*, JWT_*, API keys) to student code."""
    return {k: v for k, v in os.environ.items() if k in _LOCAL_ENV_KEEP}


def _run_local(lang: str, source: str, stdin: str, time_limit: float, memory_mb: int) -> RunResult:
    work = tempfile.mkdtemp(prefix="codexia_run_")
    env = _scrubbed_env()
    try:
        def compile_step(cmd, timeout=20.0):
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=work, env=env)
            except FileNotFoundError:
                raise CodeExecutionUnavailable(f"{cmd[0]} is not installed on this machine.")
            except OSError as exc:
                raise CodeExecutionUnavailable(f"{cmd[0]} could not be started on this machine ({type(exc).__name__}).")
            except subprocess.TimeoutExpired:
                return RunResult(status=COMPILE_ERROR, compile_output="Compilation timed out")
            if proc.returncode != 0:
                return RunResult(status=COMPILE_ERROR, compile_output=_clip(proc.stderr or proc.stdout),
                                 exit_code=proc.returncode)
            return None

        exe = os.path.join(work, "prog.exe" if os.name == "nt" else "prog")
        if lang == "python":
            path = os.path.join(work, "main.py")
            _write(path, source)
            cmd = [sys.executable or "python3", "-I", path]
        elif lang == "javascript":
            path = os.path.join(work, "main.js")
            _write(path, source)
            cmd = ["node", path]
        elif lang in ("cpp", "c"):
            path = os.path.join(work, "main.cpp" if lang == "cpp" else "main.c")
            _write(path, source)
            compiler = ["g++", "-O2", "-std=c++17"] if lang == "cpp" else ["gcc", "-O2"]
            failed = compile_step(compiler + [path, "-o", exe])
            if failed:
                return failed
            cmd = [exe]
        elif lang == "java":
            _write(os.path.join(work, "Main.java"), source)
            failed = compile_step(["javac", "Main.java"])
            if failed:
                return failed
            cmd = ["java", "-cp", work, "Main"]
        elif lang == "go":
            path = os.path.join(work, "main.go")
            _write(path, source)
            failed = compile_step(["go", "build", "-o", exe, path], timeout=40.0)
            if failed:
                return failed
            cmd = [exe]
        else:
            raise InvalidRunRequest(f"Unsupported programming language: {lang}")

        started = time.perf_counter()
        try:
            proc = subprocess.run(cmd, input=stdin or "", capture_output=True, text=True,
                                  timeout=time_limit, cwd=work, env=env)
        except FileNotFoundError:
            raise CodeExecutionUnavailable(f"{cmd[0]} is not installed on this machine.")
        except OSError as exc:  # e.g. blocked by an OS execution policy
            raise CodeExecutionUnavailable(f"The program could not be started on this machine ({type(exc).__name__}).")
        except subprocess.TimeoutExpired:
            return RunResult(status=TIMEOUT, time_ms=(time.perf_counter() - started) * 1000)
        elapsed = (time.perf_counter() - started) * 1000
        status = OK if proc.returncode == 0 else RUNTIME_ERROR
        return RunResult(status=status, stdout=_clip(proc.stdout), stderr=_clip(proc.stderr),
                         exit_code=proc.returncode, time_ms=elapsed)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _write(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


# --------------------------------------------------------------------------- dispatch and guards

def active_provider() -> str:
    """Resolve the configured provider. Raises CodeExecutionUnavailable when none is usable."""
    choice = (settings.CODE_EXEC_PROVIDER or "auto").lower()
    if choice == "judge0" or (choice == "auto" and settings.JUDGE0_URL):
        if not settings.JUDGE0_URL:
            raise CodeExecutionUnavailable("Code execution is not configured (JUDGE0_URL is missing).")
        return "judge0"
    if choice in ("local", "auto") and settings.DEBUG:
        return "local"
    if choice == "local":
        raise CodeExecutionUnavailable("The local code runner is disabled outside DEBUG mode.")
    raise CodeExecutionUnavailable("Code execution is not configured on this server.")


_slots = threading.BoundedSemaphore(max(1, settings.CODE_EXEC_MAX_CONCURRENCY))
_inflight_users: set[int] = set()
_inflight_lock = threading.Lock()


@contextlib.contextmanager
def user_run_guard(user_id: int):
    """Allow one in-flight run per user (per process) and a global concurrency ceiling."""
    with _inflight_lock:
        if user_id in _inflight_users:
            raise RunBusy("A run is already in progress. Wait for it to finish.")
        _inflight_users.add(user_id)
    try:
        yield
    finally:
        with _inflight_lock:
            _inflight_users.discard(user_id)


def run_program(code: str, language: str, stdin: str = "", time_limit_seconds: Optional[float] = None,
                memory_limit_mb: Optional[int] = None) -> RunResult:
    """Validate, prepare and execute one program. Raises InvalidRunRequest or CodeExecutionUnavailable."""
    stdin = stdin or ""
    lang = validate_request(code, language, stdin)
    provider = active_provider()
    time_limit = min(float(time_limit_seconds or 3.0), settings.CODE_EXEC_MAX_TIME_SECONDS)
    memory_mb = min(int(memory_limit_mb or 256), settings.CODE_EXEC_MAX_MEMORY_MB)
    source = prepare_source(lang, code)

    if not _slots.acquire(timeout=2.0):
        raise RunBusy("The server is busy running other programs. Please retry in a few seconds.")
    try:
        if provider == "judge0":
            return _run_judge0(lang, source, stdin, time_limit, memory_mb)
        return _run_local(lang, source, stdin, time_limit, memory_mb)
    finally:
        _slots.release()


def health() -> dict:
    """Operational status for /api/health (never raises, never leaks credentials)."""
    try:
        provider = active_provider()
    except CodeExecutionUnavailable as exc:
        return {"status": "unavailable", "detail": str(exc)}
    if provider == "local":
        return {"status": "dev-only", "provider": "local"}
    try:
        response = httpx.get(f"{settings.JUDGE0_URL.rstrip('/')}/languages", headers=_judge0_headers(), timeout=5.0)
        if response.status_code >= 400:
            return {"status": "unhealthy", "provider": "judge0", "detail": f"HTTP {response.status_code}"}
        available = {item.get("id") for item in response.json()}
        missing = [name for name, lid in judge0_language_ids().items() if lid not in available]
        if missing:
            return {"status": "degraded", "provider": "judge0", "missing_languages": missing}
        return {"status": "healthy", "provider": "judge0"}
    except Exception as exc:  # noqa: BLE001 - health must not raise
        return {"status": "unhealthy", "provider": "judge0", "detail": type(exc).__name__}
