"""
Quiz, Question, Answer schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class AnswerCreate(BaseModel):
    content: str = Field(..., min_length=1)
    is_correct: bool = False
    order_index: int = 0


class AnswerResponse(BaseModel):
    id: int
    content: str
    order_index: int

    class Config:
        from_attributes = True


class AnswerWithCorrect(AnswerResponse):
    """Response that includes the correct flag — for review mode only."""
    is_correct: bool


class QuestionCreate(BaseModel):
    question_type: str
    content: str = Field(..., min_length=5)
    explanation: Optional[str] = None
    marks: float = 1.0
    order_index: int = 0
    code_snippet: Optional[str] = None
    answers: List[AnswerCreate] = []


class QuestionUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=5)
    explanation: Optional[str] = None
    marks: Optional[float] = None
    order_index: Optional[int] = None
    code_snippet: Optional[str] = None


class QuestionResponse(BaseModel):
    id: int
    question_type: str
    content: str
    marks: float
    order_index: int
    code_snippet: Optional[str] = None
    answers: List[AnswerResponse] = []

    class Config:
        from_attributes = True


class QuestionReviewResponse(BaseModel):
    """For reviewing answers after quiz submission."""
    id: int
    question_type: str
    content: str
    explanation: Optional[str] = None
    marks: float
    code_snippet: Optional[str] = None
    answers: List[AnswerWithCorrect] = []

    class Config:
        from_attributes = True


class QuizCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    description: Optional[str] = None
    time_limit_minutes: int = Field(default=30, ge=1)
    passing_percentage: float = Field(default=50.0, ge=0, le=100)
    negative_marking: float = Field(default=0.0, ge=0)
    is_randomized: bool = False
    max_attempts: int = Field(default=3, ge=1)
    questions: List[QuestionCreate] = []


class QuizUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=300)
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = Field(None, ge=1)
    passing_percentage: Optional[float] = Field(None, ge=0, le=100)
    negative_marking: Optional[float] = Field(None, ge=0)
    is_randomized: Optional[bool] = None
    max_attempts: Optional[int] = Field(None, ge=1)
    is_published: Optional[bool] = None


class QuizResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str] = None
    time_limit_minutes: int
    total_marks: float
    passing_percentage: float
    negative_marking: float
    is_randomized: bool
    is_published: bool
    max_attempts: int
    question_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class QuizAttemptSubmit(BaseModel):
    """Student submits their quiz answers."""
    responses: List["QuizResponseSubmit"]
    time_taken_seconds: int = 0


class QuizResponseSubmit(BaseModel):
    question_id: int
    selected_answer_ids: List[int] = []
    text_answer: Optional[str] = None


class QuizAttemptResult(BaseModel):
    id: int
    quiz_id: int
    score: float
    total_marks: float
    percentage: float
    is_passed: bool
    time_taken_seconds: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    full_name: str
    score: float
    percentage: float
    time_taken_seconds: int
