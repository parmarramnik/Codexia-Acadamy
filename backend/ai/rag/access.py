"""
Authorization for course-grounded retrieval. Runs BEFORE any chunk is looked up.

Source of truth is the existing enrollment and Razorpay payment records:
  * course owner and admins always have access;
  * everyone else needs an active enrollment in a published, approved course;
  * for a PAID course they additionally need a verified (SUCCESS) payment for that course.
    Full refunds move the payment to REFUNDED and deactivate the enrollment, so access ends.
Nothing here trusts the request body or the frontend.
"""

from sqlalchemy.orm import Session

from models.course import Course, Enrollment
from models.payment import Payment, PaymentStatus
from models.user import User, UserRole


class RagAccessDenied(Exception):
    def __init__(self, message: str, status_code: int = 403, code: str = "ACCESS_DENIED"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def authorize_course_access(db: Session, user: User, course_id: int) -> Course:
    """Return the course if `user` may retrieve its material; raise RagAccessDenied otherwise."""
    if user is None:
        raise RagAccessDenied("Authentication required.", 401, "AUTH_REQUIRED")
    course = db.query(Course).filter(Course.id == course_id).first()
    privileged = _role(user) in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value) or (
        course is not None and course.instructor_id == user.id
    )
    if course is None or (not privileged and not (course.is_published and course.is_approved)):
        # Same answer for "does not exist" and "not visible" so IDs cannot be probed.
        raise RagAccessDenied("Course not found.", 404, "COURSE_NOT_FOUND")
    if privileged:
        return course

    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user.id, Enrollment.course_id == course.id, Enrollment.is_active == True)  # noqa: E712
        .first()
    )
    if not enrollment:
        raise RagAccessDenied(
            "Enroll in this course to ask questions about its material.", 403, "NOT_ENROLLED")

    if course.is_paid:
        paid = (
            db.query(Payment.id)
            .filter(Payment.user_id == user.id, Payment.course_id == course.id,
                    Payment.status == PaymentStatus.SUCCESS.value)
            .first()
        )
        if not paid:
            raise RagAccessDenied(
                "Purchase this course to ask questions about its material.", 403, "PAYMENT_REQUIRED")
    return course
