"""
Coding problem, test case, and submission schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    is_hidden: bool = False
    order_index: int = 0
    time_limit_seconds: float = 2.0
    memory_limit_mb: int = 256


class TestCaseResponse(BaseModel):
    id: int
    input_data: str
    expected_output: str
    is_hidden: bool
    order_index: int

    class Config:
        from_attributes = True


class TestCasePublicResponse(BaseModel):
    """Public view — hidden test cases show no I/O."""
    id: int
    order_index: int
    is_hidden: bool

    class Config:
        from_attributes = True


class CodingProblemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    description: str = Field(..., min_length=10)
    difficulty: str = "easy"
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    starter_code_python: Optional[str] = None
    starter_code_cpp: Optional[str] = None
    starter_code_java: Optional[str] = None
    starter_code_javascript: Optional[str] = None
    solution: Optional[str] = None
    hints: Optional[str] = None
    tags: Optional[str] = None
    test_cases: List[TestCaseCreate] = []


class CodingProblemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=300)
    description: Optional[str] = Field(None, min_length=10)
    difficulty: Optional[str] = None
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    starter_code_python: Optional[str] = None
    starter_code_cpp: Optional[str] = None
    starter_code_java: Optional[str] = None
    starter_code_javascript: Optional[str] = None
    solution: Optional[str] = None
    hints: Optional[str] = None
    tags: Optional[str] = None
    is_published: Optional[bool] = None


class CodingProblemResponse(BaseModel):
    id: int
    course_id: Optional[int] = None
    title: str
    slug: str
    description: str
    difficulty: str
    constraints: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    starter_code_python: Optional[str] = None
    starter_code_cpp: Optional[str] = None
    starter_code_java: Optional[str] = None
    starter_code_javascript: Optional[str] = None
    hints: Optional[str] = None
    tags: Optional[str] = None
    is_published: bool
    total_submissions: int
    accepted_submissions: int
    acceptance_rate: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True


class CodingProblemListResponse(BaseModel):
    id: int
    title: str
    slug: str
    difficulty: str
    tags: Optional[str] = None
    total_submissions: int
    accepted_submissions: int
    acceptance_rate: float = 0.0

    class Config:
        from_attributes = True


class CodeRunRequest(BaseModel):
    language: str
    code: str = Field(..., min_length=1)


class CodeSubmitRequest(BaseModel):
    language: str
    code: str = Field(..., min_length=1)


class SubmissionResponse(BaseModel):
    id: int
    problem_id: int
    language: str
    status: str
    test_cases_passed: int
    test_cases_total: int
    execution_time_ms: Optional[int] = None
    memory_used_mb: Optional[float] = None
    error_message: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


class TestCaseResult(BaseModel):
    test_case_id: int
    passed: bool
    input_data: str
    expected_output: str
    actual_output: Optional[str] = None
    is_hidden: bool
    execution_time_ms: Optional[int] = None


class CodeRunResult(BaseModel):
    status: str
    test_results: List[TestCaseResult] = []
    passed: int = 0
    total: int = 0
    error_message: Optional[str] = None
