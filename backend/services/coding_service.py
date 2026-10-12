"""
Coding service — business logic for coding problems, submissions, and code execution.
"""

from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from models.coding import (
    CodingProblem, TestCase, Submission,
    SubmissionStatus, ProgrammingLanguage,
)
from schemas.coding import CodingProblemCreate, CodingProblemUpdate
from utils.helpers import generate_slug, paginate_query, PaginatedResponse


from services.code_runner import InvalidRunRequest, run_program


def _as_stdin(input_data: Optional[str]) -> str:
    """Program input always ends with a newline, like a terminal."""
    if not input_data:
        return ""
    return input_data if input_data.endswith("\n") else input_data + "\n"


def execute_code_sandbox(
    code: str,
    language: str,
    input_data: str,
    expected_output: str,
    time_limit_seconds: float = 3.0,
    memory_limit_mb: int = 256
) -> tuple[bool, str, float, Optional[str], float]:
    """
    Run code in the isolated execution backend (see services/code_runner.py) and compare stdout.
    Returns: (passed, actual_output, time_ms, error_message, memory_used_mb).
    Raises CodeExecutionUnavailable when the execution backend is down, so an outage is never
    recorded as a failed submission.
    """
    try:
        result = run_program(code, language, _as_stdin(input_data), time_limit_seconds, memory_limit_mb)
    except InvalidRunRequest as exc:
        return False, "", 0.0, str(exc), 0.0
    if not result.ok:
        return False, "", result.time_ms, result.error_text, result.memory_mb
    actual_output = result.stdout.strip()
    expected = (expected_output or "").strip().replace("\r\n", "\n")
    return actual_output == expected, actual_output, result.time_ms, None, result.memory_mb


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

    try:
        result = run_program(code, language, _as_stdin(custom_input), 5.0, 256)
    except InvalidRunRequest as exc:
        return {"status": "error", "input_data": custom_input, "actual_output": "", "stdout": "", "stderr": "",
                "error_message": str(exc), "run_status": "invalid", "exit_code": None,
                "execution_time_ms": 0, "memory_used_mb": 0}
    return {
        "status": "completed" if result.ok else "error",
        "run_status": result.status,
        "input_data": custom_input,
        "actual_output": result.stdout,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "error_message": result.error_text,
        "exit_code": result.exit_code,
        "execution_time_ms": int(result.time_ms),
        "memory_used_mb": round(result.memory_mb, 2),
    }


def get_random_problem_slug(db: Session) -> Optional[str]:
    """Return a random published problem slug for Pick One feature."""
    from sqlalchemy.sql import func
    prob = db.query(CodingProblem).filter(CodingProblem.is_published == True).order_by(func.random()).first()
    return prob.slug if prob else None

