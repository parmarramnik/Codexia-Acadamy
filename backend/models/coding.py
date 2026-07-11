"""
Coding practice models: CodingProblem, TestCase, Submission.
Supports multiple languages and hidden test cases.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Text, Float
)
from sqlalchemy.orm import relationship

from database import Base


class ProgrammingLanguage(str, enum.Enum):
    PYTHON = "python"
    CPP = "cpp"
    JAVA = "java"
    JAVASCRIPT = "javascript"


class ProblemDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class SubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    TIME_LIMIT = "time_limit"
    RUNTIME_ERROR = "runtime_error"
    COMPILATION_ERROR = "compilation_error"


class CodingProblem(Base):
    __tablename__ = "coding_problems"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(300), nullable=False, index=True)
    slug = Column(String(350), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    difficulty = Column(Enum(ProblemDifficulty), default=ProblemDifficulty.EASY, nullable=False, index=True)
    constraints = Column(Text, nullable=True)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)
    starter_code_python = Column(Text, nullable=True)
    starter_code_cpp = Column(Text, nullable=True)
    starter_code_java = Column(Text, nullable=True)
    starter_code_javascript = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    hints = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    is_published = Column(Boolean, default=False, nullable=False)
    total_submissions = Column(Integer, default=0, nullable=False)
    accepted_submissions = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    course = relationship("Course", back_populates="coding_problems")
    test_cases = relationship("TestCase", back_populates="problem", cascade="all, delete-orphan", order_by="TestCase.order_index")
    submissions = relationship("Submission", back_populates="problem", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CodingProblem(id={self.id}, title='{self.title}', difficulty='{self.difficulty}')>"


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("coding_problems.id", ondelete="CASCADE"), nullable=False)
    input_data = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=0)
    time_limit_seconds = Column(Float, default=2.0)
    memory_limit_mb = Column(Integer, default=256)

    # Relationships
    problem = relationship("CodingProblem", back_populates="test_cases")

    def __repr__(self):
        return f"<TestCase(id={self.id}, hidden={self.is_hidden})>"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("coding_problems.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    language = Column(Enum(ProgrammingLanguage), nullable=False)
    code = Column(Text, nullable=False)
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING, nullable=False)
    test_cases_passed = Column(Integer, default=0)
    test_cases_total = Column(Integer, default=0)
    execution_time_ms = Column(Integer, nullable=True)
    memory_used_mb = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    problem = relationship("CodingProblem", back_populates="submissions")
    user = relationship("User", back_populates="submissions")

    def __repr__(self):
        return f"<Submission(id={self.id}, status='{self.status}')>"
