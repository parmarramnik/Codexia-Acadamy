"""
Certificate service — generates PDF certificates with QR verification.
"""

from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from models.certificate import Certificate
from models.course import Enrollment
from models.user import User
from models.course import Course
from utils.pdf_generator import generate_certificate_pdf


def generate_certificate(
    db: Session,
    user_id: int,
    course_id: int,
) -> Certificate:
    """Generate a certificate for a completed course."""
    # Check if certificate already exists
    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id, Certificate.course_id == course_id)
        .first()
    )
    if existing:
        return existing

    # Verify enrollment and completion
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
            Enrollment.is_active == True,
        )
        .first()
    )
    if not enrollment:
        raise ValueError("You are not enrolled in this course")

    if enrollment.completion_percentage < 80:
        raise ValueError("You must complete at least 80% of the course to earn a certificate")

    user = db.query(User).filter(User.id == user_id).first()
    course = db.query(Course).filter(Course.id == course_id).first()
    instructor = db.query(User).filter(User.id == course.instructor_id).first()

    # Create certificate record
    certificate = Certificate(
        user_id=user_id,
        course_id=course_id,
        user_full_name=user.full_name,
        course_title=course.title,
        instructor_name=instructor.full_name if instructor else "Codexia Instructor",
        completion_date=datetime.now(timezone.utc),
    )
    db.add(certificate)
    db.flush()

    # Generate PDF
    pdf_path = generate_certificate_pdf(
        certificate_uid=certificate.certificate_uid,
        user_full_name=user.full_name,
        course_title=course.title,
        instructor_name=instructor.full_name if instructor else "Codexia Instructor",
        completion_date=certificate.completion_date,
    )
    certificate.certificate_url = f"/static/certificates/certificate_{certificate.certificate_uid}.pdf"

    db.commit()
    db.refresh(certificate)
    return certificate


def get_user_certificates(db: Session, user_id: int) -> List[Certificate]:
    """Get all certificates for a user."""
    return (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id)
        .order_by(Certificate.created_at.desc())
        .all()
    )


def verify_certificate(db: Session, certificate_uid: str) -> Optional[Certificate]:
    """Verify a certificate by its unique ID."""
    return (
        db.query(Certificate)
        .filter(Certificate.certificate_uid == certificate_uid, Certificate.is_valid == True)
        .first()
    )
