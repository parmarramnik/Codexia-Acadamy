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

__all__ = [
    "User", "Role", "Permission", "RolePermission",
    "Course", "Module", "Lecture", "Enrollment", "Category",
    "Video", "Resource", "Note", "Flashcard", "Bookmark",
    "Quiz", "Question", "Answer", "QuizAttempt", "QuizResponse",
    "CodingProblem", "TestCase", "Submission",
    "Progress", "StudySession", "Notification", "Announcement", "ChatHistory",
    "Certificate", "AuditLog", "SecurityLog",
]
