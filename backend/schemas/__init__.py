"""
Schemas package.
"""

from schemas.user import (
    UserCreate, UserLogin, UserUpdate, UserResponse, UserListResponse,
    TokenResponse, RefreshTokenRequest, PasswordReset, PasswordResetConfirm,
    ChangePassword, MessageResponse,
)
from schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListResponse,
    ModuleCreate, ModuleUpdate, ModuleResponse,
    LectureCreate, LectureUpdate, LectureResponse,
    EnrollmentResponse, ProgressUpdate,
)
from schemas.quiz import (
    QuizCreate, QuizUpdate, QuizResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionReviewResponse,
    AnswerCreate, AnswerResponse, AnswerWithCorrect,
    QuizAttemptSubmit, QuizAttemptResult, QuizResponseSubmit,
    LeaderboardEntry,
)
from schemas.coding import (
    CodingProblemCreate, CodingProblemUpdate, CodingProblemResponse, CodingProblemListResponse,
    TestCaseCreate, TestCaseResponse,
    CodeRunRequest, CodeSubmitRequest, SubmissionResponse, CodeRunResult,
)
from schemas.analytics import (
    NoteCreate, NoteUpdate, NoteResponse,
    FlashcardCreate, FlashcardUpdate, FlashcardResponse,
    CertificateResponse, CertificateVerifyResponse,
    DashboardAnalytics, StudySessionResponse,
    NotificationResponse, AnnouncementCreate, AnnouncementResponse,
    ChatMessage, ChatResponse, AIGenerateRequest, AIDebugRequest, AIDebugResponse,
)
