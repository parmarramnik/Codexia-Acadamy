"""
Models package — imports all models so they register with Base.metadata.
"""

from models.user import User, Role, Permission, RolePermission
from models.course import Course, Module, Lecture, Enrollment, Category
from models.content import Video, Resource, Note, Flashcard, Bookmark
from models.quiz import Quiz, Question, Answer, QuizAttempt, QuizResponse
from models.coding import CodingProblem, TestCase, Submission
from models.analytics import Progress, StudySession, Notification, Announcement, ChatHistory
from models.certificate import Certificate
from models.audit import AuditLog, SecurityLog
from models.session import Session, LoginHistory
from models.schedule import Reminder, StudyPlan
from models.git import GitBranch, GitCommit, GitTag, GitMergeHistory
from models.payment import Payment, PaymentEvent, PaymentIdempotencyKey, CoursePriceRequest
import models.v3_models
import models.v4_models

__all__ = [
    "User", "Role", "Permission", "RolePermission",
    "Course", "Module", "Lecture", "Enrollment", "Category",
    "Video", "Resource", "Note", "Flashcard", "Bookmark",
    "Quiz", "Question", "Answer", "QuizAttempt", "QuizResponse",
    "CodingProblem", "TestCase", "Submission",
    "Progress", "StudySession", "Notification", "Announcement", "ChatHistory",
    "Certificate", "AuditLog", "SecurityLog",
    "Session", "LoginHistory", "Reminder", "StudyPlan",
    "GitBranch", "GitCommit", "GitTag", "GitMergeHistory",
    "Payment", "PaymentEvent", "PaymentIdempotencyKey", "CoursePriceRequest",
]

