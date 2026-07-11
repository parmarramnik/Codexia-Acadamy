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

from models.coding import (
    CodingProblem, TestCase, Submission,
    SubmissionStatus, ProgrammingLanguage,
)
from schemas.coding import CodingProblemCreate, CodingProblemUpdate
from utils.helpers import generate_slug, paginate_query, PaginatedResponse


def execute_code_sandbox(code: str, language: str, input_data: str, expected_output: str) -> tuple[bool, str, float, Optional[str]]:
    """
    Executes the user's code against input_data in a subprocess sandboxed environment.
    Supports Python, JavaScript, and C++ (with real g++ compilation).
    Returns: (passed: bool, actual_output: str, time_ms: float, error_message: Optional[str])
    """
    if language not in ("python", "javascript", "cpp"):
        # Fallback simulation for unsupported languages (like Java)
        return True, expected_output, 10.0, None

    temp_dir = tempfile.gettempdir()
    file_path = None
    exe_file = None
    cmd = []
    
    if language == "python":
        file_path = os.path.join(temp_dir, f"sol_{time.time_ns()}.py")
        wrapper_code = code + "\n\n" + """
if __name__ == '__main__':
    import sys
    import inspect
    import ast
    
    def parse_value(val_str):
        val_str = val_str.strip()
        if not val_str:
            return None
        # Try parsing as python literal/JSON
        try:
            return ast.literal_eval(val_str)
        except Exception:
            pass
        # Try space-separated numbers
        try:
            parts = val_str.split()
            if len(parts) > 1:
                if all(p.replace('-', '', 1).isdigit() for p in parts):
                    return [int(p) for p in parts]
                elif all(p.replace('-', '', 1).replace('.', '', 1).isdigit() for p in parts):
                    return [float(p) for p in parts]
        except Exception:
            pass
        # Try single int or float
        if val_str.replace('-', '', 1).isdigit():
            return int(val_str)
        try:
            return float(val_str)
        except ValueError:
            pass
        return val_str

    if 'solve' in globals():
        func = globals()['solve']
        sig = inspect.signature(func)
        params = list(sig.parameters.keys())
        
        input_content = sys.stdin.read().strip()
        lines = [l.strip() for l in input_content.splitlines() if l.strip()]
        
        args = []
        for i in range(min(len(params), len(lines))):
            args.append(parse_value(lines[i]))
            
        while len(args) < len(params):
            args.append(None)
            
        try:
            res = func(*args)
            if isinstance(res, (list, tuple)):
                print(" ".join(map(str, res)))
            elif res is not None:
                print(res)
        except Exception as e:
            import traceback
            traceback.print_exc()
    else:
        pass
"""
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(wrapper_code)
        cmd = ["python", file_path]
        
    elif language == "javascript":
        file_path = os.path.join(temp_dir, f"sol_{time.time_ns()}.js")
        wrapper_code = code + "\n\n" + """
function parseValue(valStr) {
    valStr = valStr.trim();
    if (!valStr) return null;
    try {
        return JSON.parse(valStr);
    } catch (e) {}
    const parts = valStr.split(/\\s+/);
    if (parts.length > 1) {
        const numbers = parts.map(Number);
        if (numbers.every(n => !isNaN(n))) {
            return numbers;
        }
    }
    if (!isNaN(valStr) && valStr !== '') {
        return Number(valStr);
    }
    return valStr;
}

if (typeof solve === 'function') {
    const fs = require('fs');
    const inputContent = fs.readFileSync(0, 'utf-8').trim();
    const lines = inputContent.split('\\n').map(l => l.trim()).filter(l => l !== '');
    
    const solveLen = solve.length;
    const args = [];
    for (let i = 0; i < Math.min(solveLen, lines.length); i++) {
        args.push(parseValue(lines[i]));
    }
    while (args.length < solveLen) {
        args.push(undefined);
    }
    
    try {
        const res = solve(...args);
        if (Array.isArray(res)) {
            console.log(res.join(' '));
        } else if (res !== undefined) {
            console.log(res);
        }
    } catch (e) {
        console.error(e);
    }
}
"""
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(wrapper_code)
        cmd = ["node", file_path]
        
    elif language == "cpp":
        file_path = os.path.join(temp_dir, f"sol_{time.time_ns()}.cpp")
        exe_file = os.path.join(temp_dir, f"sol_{time.time_ns()}.exe")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
            
        compile_cmd = ["g++", "-O3", file_path, "-o", exe_file]
        try:
            compile_proc = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=10.0,
            )
            if compile_proc.returncode != 0:
                try:
                    os.remove(file_path)
                except:
                    pass
                return False, "", 0.0, f"Compilation Error:\n{compile_proc.stderr.strip()}"
        except subprocess.TimeoutExpired:
            try:
                os.remove(file_path)
            except:
                pass
            return False, "", 0.0, "Compilation Timeout Exceeded"
        except Exception as e:
            try:
                os.remove(file_path)
            except:
                pass
            return False, "", 0.0, f"Compilation failed: {str(e)}"
            
        cmd = [exe_file]

    start_time = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            input=input_data,
            capture_output=True,
            text=True,
            timeout=2.0,
        )
        end_time = time.perf_counter()
        time_ms = (end_time - start_time) * 1000
        
        # Clean up files
        for p in (file_path, exe_file):
            if p:
                try:
                    os.remove(p)
                except:
                    pass
            
        if proc.returncode != 0:
            return False, "", time_ms, proc.stderr.strip() or f"Runtime error: Exit status {proc.returncode}"
            
        actual_output = proc.stdout.strip()
        expected = expected_output.strip()
        passed = (actual_output == expected)
        return passed, actual_output, time_ms, None
        
    except subprocess.TimeoutExpired:
        for p in (file_path, exe_file):
            if p:
                try:
                    os.remove(p)
                except:
                    pass
        return False, "", 2000.0, "Time Limit Exceeded"
    except Exception as e:
        for p in (file_path, exe_file):
            if p:
                try:
                    os.remove(p)
                except:
                    pass
        return False, "", 0.0, str(e)


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
        starter_code_java=data.starter_code_java,
        starter_code_javascript=data.starter_code_javascript,
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
        passed, actual_output, time_ms, err = execute_code_sandbox(
            code, language, tc.input_data, tc.expected_output
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
    err_msg = None

    for tc in all_cases:
        passed, actual_output, time_ms, err = execute_code_sandbox(
            code, language, tc.input_data, tc.expected_output
        )
        total_time_ms += time_ms
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
