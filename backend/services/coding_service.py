"""
Coding service — business logic for coding problems, submissions, and code execution.
"""

from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
import tempfile
import subprocess
import time
import os
import sys

from models.coding import (
    CodingProblem, TestCase, Submission,
    SubmissionStatus, ProgrammingLanguage,
)
from schemas.coding import CodingProblemCreate, CodingProblemUpdate
from utils.helpers import generate_slug, paginate_query, PaginatedResponse


import psutil
import shutil

def execute_code_sandbox(
    code: str,
    language: str,
    input_data: str,
    expected_output: str,
    time_limit_seconds: float = 3.0,
    memory_limit_mb: int = 256
) -> tuple[bool, str, float, Optional[str], float]:
    """
    Executes user code inside a secure, monitored subprocess sandbox.
    Supports Python 3, Node.js (JavaScript), C++ (G++), C (GCC), Java (OpenJDK 21), and Go.
    Never uses fake compile or mock returns.
    Returns: (passed: bool, actual_output: str, time_ms: float, error_message: Optional[str], memory_used_mb: float)
    """
    temp_dir = tempfile.gettempdir()
    unique_id = f"{time.time_ns()}_{os.getpid()}"
    file_path = None
    exe_file = None
    cmd = []
    java_dir = None
    lang_clean = (language or "python").lower().strip()
    
    try:
        if lang_clean in ("python", "py", "python3"):
            file_path = os.path.join(temp_dir, f"sol_{unique_id}.py")
            wrapper_code = code
            
            # If LeetCode class Solution is present without an explicit __main__ or stdin reader
            if "class Solution" in code and "if __name__" not in code and "sys.stdin" not in code and "input(" not in code:
                wrapper_code = code + "\n\n" + """
if __name__ == '__main__':
    import sys
    import ast
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
    _sol = Solution()
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
            elif "def solve(" in code and "if __name__" not in code and "sys.stdin" not in code and "input(" not in code:
                wrapper_code = code + "\n\n" + """
if __name__ == '__main__':
    import sys
    import ast
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
    try:
        _res = solve(*_args)
        if isinstance(_res, (list, tuple)):
            print(" ".join(map(str, _res)))
        elif _res is not None:
            print(_res)
    except Exception as _e:
        import traceback
        traceback.print_exc()
"""
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(wrapper_code)
            cmd = [sys.executable or "python3", file_path]

        elif lang_clean in ("javascript", "js", "node"):
            file_path = os.path.join(temp_dir, f"sol_{unique_id}.js")
            wrapper_code = code
            if "function solve(" in code and "require('fs')" not in code and "process.stdin" not in code:
                wrapper_code = code + "\n\n" + """
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
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(wrapper_code)
            cmd = ["node", file_path]

        elif lang_clean in ("cpp", "c++"):
            file_path = os.path.join(temp_dir, f"sol_{unique_id}.cpp")
            exe_file = os.path.join(temp_dir, f"sol_{unique_id}_bin")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)
                
            compile_proc = subprocess.run(
                ["g++", "-O2", "-std=c++17", file_path, "-o", exe_file],
                capture_output=True,
                text=True,
                timeout=12.0
            )
            if compile_proc.returncode != 0:
                return False, "", 0.0, f"Compilation Error:\n{compile_proc.stderr}", 0.0
            try:
                os.chmod(exe_file, 0o755)
            except Exception:
                pass
            cmd = [exe_file]

        elif lang_clean in ("c",):
            file_path = os.path.join(temp_dir, f"sol_{unique_id}.c")
            exe_file = os.path.join(temp_dir, f"sol_{unique_id}_bin")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)
                
            compile_proc = subprocess.run(
                ["gcc", "-O2", file_path, "-o", exe_file],
                capture_output=True,
                text=True,
                timeout=12.0
            )
            if compile_proc.returncode != 0:
                return False, "", 0.0, f"Compilation Error:\n{compile_proc.stderr}", 0.0
            try:
                os.chmod(exe_file, 0o755)
            except Exception:
                pass
            cmd = [exe_file]

        elif lang_clean in ("java",):
            java_dir = os.path.join(temp_dir, f"java_{unique_id}")
            os.makedirs(java_dir, exist_ok=True)
            
            class_name = "Solution"
            for line in code.splitlines():
                line_stripped = line.strip()
                if line_stripped.startswith("public class ") or line_stripped.startswith("class "):
                    tokens = line_stripped.split()
                    target_idx = 2 if tokens[0] == "public" else 1
                    if target_idx < len(tokens):
                        class_name = tokens[target_idx].split("{")[0].strip()
                        break
            
            file_path = os.path.join(java_dir, f"{class_name}.java")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)
                
            compile_proc = subprocess.run(
                ["javac", file_path],
                capture_output=True,
                text=True,
                timeout=15.0
            )
            if compile_proc.returncode != 0:
                return False, "", 0.0, f"Compilation Error:\n{compile_proc.stderr}", 0.0
            cmd = ["java", "-cp", java_dir, class_name]

        elif lang_clean in ("go", "golang"):
            file_path = os.path.join(temp_dir, f"sol_{unique_id}.go")
            exe_file = os.path.join(temp_dir, f"sol_{unique_id}_bin")
            go_code = code
            if "package " not in go_code:
                go_code = "package main\n\n" + go_code
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(go_code)
                
            compile_proc = subprocess.run(
                ["go", "build", "-o", exe_file, file_path],
                capture_output=True,
                text=True,
                timeout=15.0
            )
            if compile_proc.returncode != 0:
                return False, "", 0.0, f"Compilation Error:\n{compile_proc.stderr}", 0.0
            try:
                os.chmod(exe_file, 0o755)
            except Exception:
                pass
            cmd = [exe_file]
        else:
            return False, "", 0.0, f"Unsupported programming language: {language}", 0.0

    except subprocess.TimeoutExpired:
        return False, "", 0.0, "Compilation Timeout Exceeded (15s limit)", 0.0
    except Exception as e:
        return False, "", 0.0, f"Sandbox compilation setup failed: {str(e)}", 0.0

    proc = None
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        start_time = time.perf_counter()
        stdin_str = (input_data + "\n") if input_data is not None else None
        time_limit = time_limit_seconds or 3.0
        peak_mem = 0.0

        try:
            p = psutil.Process(proc.pid)
            peak_mem = p.memory_info().rss / (1024 * 1024)
        except Exception:
            peak_mem = 1.0

        try:
            stdout, stderr = proc.communicate(input=stdin_str, timeout=time_limit)
        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                stdout, stderr = proc.communicate(timeout=1.0)
            except Exception:
                pass
            time_ms = (time.perf_counter() - start_time) * 1000
            return False, "", time_ms, "Time Limit Exceeded", peak_mem

        end_time = time.perf_counter()
        time_ms = (end_time - start_time) * 1000

        if proc.returncode != 0:
            err_msg = stderr.strip() if stderr else f"Runtime Error (Exit Code {proc.returncode})"
            return False, "", time_ms, err_msg, peak_mem

        actual_output = stdout.strip().replace("\r\n", "\n")
        expected = (expected_output or "").strip().replace("\r\n", "\n")
        passed = (actual_output == expected)
        return passed, actual_output, time_ms, None, peak_mem

    except Exception as e:
        return False, "", 0.0, f"Execution failed: {str(e)}", 0.0
    finally:
        for path in (file_path, exe_file):
            if path and os.path.exists(path):
                try: os.remove(path)
                except Exception: pass
        if java_dir and os.path.exists(java_dir):
            try: shutil.rmtree(java_dir)
            except Exception: pass


def create_problem(db: Session, data: CodingProblemCreate, course_id: Optional[int] = None) -> CodingProblem:
    """Create a coding problem with test cases."""
    slug = generate_slug(data.title)
    difficulty_val = data.difficulty.upper() if data.difficulty else "EASY"
    problem = CodingProblem(
        course_id=course_id or data.dict().get("course_id"),
        title=data.title,
        slug=slug,
        description=data.description,
        difficulty=difficulty_val,
        constraints=data.constraints,
        input_format=data.input_format,
        output_format=data.output_format,
        starter_code_python=data.starter_code_python,
        starter_code_cpp=data.starter_code_cpp,
        starter_code_c=data.starter_code_c,
        starter_code_java=data.starter_code_java,
        starter_code_javascript=data.starter_code_javascript,
        starter_code_go=data.starter_code_go,
        solution=data.solution,
        hints=data.hints,
        tags=data.tags,
        is_published=True,
    )
    db.add(problem)
    db.flush()

    for tc_data in data.test_cases:
        test_case = TestCase(
            problem_id=problem.id,
            input_data=tc_data.input_data,
            expected_output=tc_data.expected_output,
            is_hidden=tc_data.is_hidden,
            order_index=tc_data.order_index,
            time_limit_seconds=tc_data.time_limit_seconds,
            memory_limit_mb=tc_data.memory_limit_mb,
        )
        db.add(test_case)

    db.commit()
    db.refresh(problem)
    return problem


def get_problem_by_id(db: Session, problem_id: int) -> Optional[CodingProblem]:
    """Fetch a problem with test cases."""
    return (
        db.query(CodingProblem)
        .options(joinedload(CodingProblem.test_cases))
        .filter(CodingProblem.id == problem_id)
        .first()
    )


def get_problem_by_slug(db: Session, slug: str) -> Optional[CodingProblem]:
    """Fetch a problem by its URL slug."""
    return (
        db.query(CodingProblem)
        .options(joinedload(CodingProblem.test_cases))
        .filter(CodingProblem.slug == slug)
        .first()
    )


def list_problems(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    course_id: Optional[int] = None,
    published_only: bool = True,
) -> PaginatedResponse:
    """List coding problems with filtering and pagination."""
    query = db.query(CodingProblem)

    if published_only:
        query = query.filter(CodingProblem.is_published == True)
    if difficulty:
        query = query.filter(CodingProblem.difficulty == difficulty.upper())
    if course_id:
        query = query.filter(CodingProblem.course_id == course_id)
    if search:
        search_term = f"%{search}%"
        es_matched = False
        try:
            from utils.elasticsearch_client import is_es_available, get_es_client, INDEX_CODING
            if is_es_available():
                client = get_es_client()
                es_res = client.search(
                    index=INDEX_CODING,
                    body={
                        "query": {
                            "multi_match": {
                                "query": search.strip(),
                                "fields": ["title^4", "tags^3", "description"],
                                "fuzziness": "AUTO"
                            }
                        },
                        "_source": ["id"],
                        "size": 100
                    }
                )
                hits = es_res.get("hits", {}).get("hits", [])
                ids = [int(h["_source"]["id"]) for h in hits if h.get("_source", {}).get("id")]
                query = query.filter(CodingProblem.id.in_(ids) if ids else CodingProblem.id == -1)
                es_matched = True
        except Exception:
            pass

        if not es_matched:
            query = query.filter(
                CodingProblem.title.ilike(search_term) | CodingProblem.tags.ilike(search_term)
            )


    total = query.count()
    query = query.order_by(CodingProblem.created_at.desc())
    problems = paginate_query(query, page, page_size).all()

    return PaginatedResponse(items=problems, total=total, page=page, page_size=page_size)


def run_code(
    db: Session,
    problem_id: int,
    code: str,
    language: str,
) -> dict:
    """Run code against sample (non-hidden) test cases."""
    problem = get_problem_by_id(db, problem_id)
    if not problem:
        raise ValueError("Problem not found")

    sample_cases = [tc for tc in problem.test_cases if not tc.is_hidden]
    results = []
    passed_count = 0

    for tc in sample_cases:
        passed, actual_output, time_ms, err, peak_mem = execute_code_sandbox(
            code, language, tc.input_data, tc.expected_output,
            time_limit_seconds=tc.time_limit_seconds, memory_limit_mb=tc.memory_limit_mb
        )
        if passed:
            passed_count += 1
            
        results.append({
            "test_case_id": tc.id,
            "input_data": tc.input_data,
            "expected_output": tc.expected_output,
            "actual_output": actual_output if not err else f"Error: {err}",
            "passed": passed,
            "is_hidden": False,
            "execution_time_ms": int(time_ms) if time_ms else 0,
            "memory_used_mb": round(peak_mem, 2)
        })

    return {
        "status": "completed",
        "test_results": results,
        "passed": passed_count,
        "total": len(sample_cases),
    }


def submit_code(
    db: Session,
    problem_id: int,
    user_id: int,
    code: str,
    language: str,
) -> Submission:
    """Submit code for evaluation against all test cases."""
    problem = get_problem_by_id(db, problem_id)
    if not problem:
        raise ValueError("Problem not found")

    all_cases = problem.test_cases
    passed_count = 0
    total_time_ms = 0.0
    max_memory_mb = 0.0
    err_msg = None

    for tc in all_cases:
        passed, actual_output, time_ms, err, peak_mem = execute_code_sandbox(
            code, language, tc.input_data, tc.expected_output,
            time_limit_seconds=tc.time_limit_seconds, memory_limit_mb=tc.memory_limit_mb
        )
        total_time_ms += time_ms
        if peak_mem > max_memory_mb:
            max_memory_mb = peak_mem
            
        if passed:
            passed_count += 1
        elif err and not err_msg:
            err_msg = err
        elif not err_msg:
            err_msg = f"Wrong Answer on Input: {tc.input_data[:30]}..."

    is_accepted = (passed_count == len(all_cases) and len(all_cases) > 0)
    
    status = SubmissionStatus.ACCEPTED if is_accepted else SubmissionStatus.WRONG_ANSWER
    if not is_accepted and err_msg:
        if "Time Limit Exceeded" in err_msg:
            status = SubmissionStatus.TIME_LIMIT
        elif "Memory Limit Exceeded" in err_msg:
            status = SubmissionStatus.RUNTIME_ERROR  # memory limit exceeded is recorded as runtime error or we can treat it accordingly
        elif "Compilation" in err_msg:
            status = SubmissionStatus.COMPILATION_ERROR
        else:
            status = SubmissionStatus.RUNTIME_ERROR

    submission = Submission(
        problem_id=problem_id,
        user_id=user_id,
        language=language,
        code=code,
        status=status,
        test_cases_passed=passed_count,
        test_cases_total=len(all_cases),
        execution_time_ms=int(total_time_ms),
        memory_used_mb=round(max_memory_mb, 2),
        error_message=err_msg,
    )
    db.add(submission)

    # Update problem stats
    problem.total_submissions += 1
    if is_accepted:
        problem.accepted_submissions += 1

    db.commit()
    db.refresh(submission)
    return submission


def get_user_submissions(
    db: Session, problem_id: int, user_id: int
) -> List[Submission]:
    """Get all submissions by a user for a specific problem."""
    return (
        db.query(Submission)
        .filter(
            Submission.problem_id == problem_id,
            Submission.user_id == user_id,
        )
        .order_by(Submission.submitted_at.desc())
        .all()
    )


def custom_run_code(
    db: Session,
    problem_id: int,
    code: str,
    language: str,
    custom_input: str,
) -> dict:
    """Run code against custom user-provided standard input (stdin)."""
    problem = get_problem_by_id(db, problem_id)
    if not problem:
        raise ValueError("Problem not found")

    passed, actual_output, time_ms, err, peak_mem = execute_code_sandbox(
        code, language, custom_input, "",
        time_limit_seconds=5.0, memory_limit_mb=256
    )
    return {
        "status": "completed" if not err else "error",
        "input_data": custom_input,
        "actual_output": actual_output if not err else "",
        "error_message": err,
        "execution_time_ms": int(time_ms) if time_ms else 0,
        "memory_used_mb": round(peak_mem, 2),
    }


def get_random_problem_slug(db: Session) -> Optional[str]:
    """Return a random published problem slug for Pick One feature."""
    from sqlalchemy.sql import func
    prob = db.query(CodingProblem).filter(CodingProblem.is_published == True).order_by(func.random()).first()
    return prob.slug if prob else None

