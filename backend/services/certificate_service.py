"""
Certificate service — issuance, lookup, verification and on-demand rendering.

Certificates are issued only by the server (after an enrollment reaches the completion
threshold), stored in the database with a unique UUID, a human-readable credential ID
and an HMAC signature. PDFs and QR codes are rendered from that record on request.
"""

from typing import Optional, List
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from models.certificate import Certificate
from models.course import Enrollment, Course
from models.user import User
from utils.certificate_security import (
    new_credential_id,
    normalize_identifier,
    sign_certificate,
    signature_is_valid,
    verification_code,
    verification_url,
)
from utils.pdf_generator import render_certificate_pdf, render_qr_svg

ISSUER_NAME = "Codexia Academy"
MIN_COMPLETION_PERCENT = 80


def pdf_path(certificate_uid: str) -> str:
    """API-relative download path (works behind the gateway and on any backend host)."""
    return f"{settings.API_PREFIX}/certificates/{certificate_uid}/pdf"


def _unique_credential_id(db: Session, issued: Optional[datetime]) -> str:
    for _ in range(10):
        candidate = new_credential_id(issued)
        if not db.query(Certificate.id).filter(Certificate.credential_id == candidate).first():
            return candidate
    raise RuntimeError("Could not allocate a unique credential ID")


def ensure_security(db: Session, cert: Certificate, commit: bool = True) -> bool:
    """Fill in credential ID / signature / download path for records that predate them."""
    changed = False
    if not cert.credential_id:
        cert.credential_id = _unique_credential_id(db, cert.completion_date)
        changed = True
    if not cert.signature:
        cert.signature = sign_certificate(cert)
        changed = True
    expected_url = pdf_path(cert.certificate_uid)
    if cert.certificate_url != expected_url:
        cert.certificate_url = expected_url
        changed = True
    if changed and commit:
        db.commit()
        db.refresh(cert)
    return changed


def backfill_certificates(db: Session) -> int:
    count = 0
    for cert in db.query(Certificate).all():
        if ensure_security(db, cert, commit=False):
            count += 1
    if count:
        db.commit()
    return count


def generate_certificate(
    db: Session,
    user_id: int,
    course_id: int,
) -> Certificate:
    """Issue a certificate for a completed course (idempotent per user + course)."""
    existing = (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id, Certificate.course_id == course_id)
        .first()
    )
    if existing:
        ensure_security(db, existing)
        return existing

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

    if (enrollment.completion_percentage or 0) < MIN_COMPLETION_PERCENT:
        raise ValueError(f"You must complete at least {MIN_COMPLETION_PERCENT}% of the course to earn a certificate")

    user = db.query(User).filter(User.id == user_id).first()
    course = db.query(Course).filter(Course.id == course_id).first()
    if not user or not course:
        raise ValueError("Course or user not found")
    instructor = db.query(User).filter(User.id == course.instructor_id).first()

    issued_at = datetime.now(timezone.utc)
    certificate = Certificate(
        user_id=user_id,
        course_id=course_id,
        user_full_name=(user.full_name or user.username or user.email).strip(),
        course_title=course.title.strip(),
        instructor_name=(instructor.full_name if instructor and instructor.full_name else "Codexia Instructor").strip(),
        completion_date=issued_at,
        credential_id=_unique_credential_id(db, issued_at),
    )
    db.add(certificate)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent request issued it first — return that one
        db.rollback()
        existing = (
            db.query(Certificate)
            .filter(Certificate.user_id == user_id, Certificate.course_id == course_id)
            .first()
        )
        if existing:
            ensure_security(db, existing)
            return existing
        raise
    db.refresh(certificate)

    # Sign the stored (database-normalized) values, then record the download path
    certificate.signature = sign_certificate(certificate)
    certificate.certificate_url = pdf_path(certificate.certificate_uid)
    db.commit()
    db.refresh(certificate)
    return certificate


def get_user_certificates(db: Session, user_id: int) -> List[Certificate]:
    certs = (
        db.query(Certificate)
        .filter(Certificate.user_id == user_id)
        .order_by(Certificate.created_at.desc())
        .all()
    )
    for cert in certs:
        ensure_security(db, cert)
    return certs


def find_certificate(db: Session, identifier: str) -> Optional[Certificate]:
    """Look up by UUID or credential ID (valid and revoked records alike)."""
    ident = normalize_identifier(identifier)
    if not ident or len(ident) > 64:
        return None
    cert = (
        db.query(Certificate)
        .filter(or_(Certificate.certificate_uid == ident, Certificate.credential_id == ident))
        .first()
    )
    if cert:
        ensure_security(db, cert)
    return cert


def verify_certificate(db: Session, certificate_uid: str) -> Optional[Certificate]:
    """Return the certificate only if it is valid and its signature checks out."""
    cert = find_certificate(db, certificate_uid)
    if cert and cert.is_valid and signature_is_valid(cert):
        return cert
    return None


def verification_status(cert: Certificate) -> str:
    if not cert.is_valid:
        return "REVOKED"
    if not signature_is_valid(cert):
        return "INTEGRITY_FAILED"
    return "VERIFIED"


def verification_payload(cert: Certificate, request=None) -> dict:
    status = verification_status(cert)
    course = cert.course
    return {
        "status": status,
        "is_valid": status == "VERIFIED",
        "certificate_uid": cert.certificate_uid,
        "credential_id": cert.credential_id,
        "verification_code": verification_code(cert.signature),
        "user_full_name": cert.user_full_name,
        "course_title": cert.course_title,
        "course_slug": course.slug if course else None,
        "course_duration_hours": course.duration_hours if course else None,
        "course_total_lectures": course.total_lectures if course else None,
        "instructor_name": cert.instructor_name,
        "completion_date": cert.completion_date,
        "issued_at": cert.created_at,
        "issuer": ISSUER_NAME,
        "certificate_url": pdf_path(cert.certificate_uid),
        "verification_url": verification_url(cert.certificate_uid, request),
        "checked_at": datetime.now(timezone.utc),
    }


def render_pdf(cert: Certificate, request=None) -> bytes:
    course = cert.course
    return render_certificate_pdf(
        certificate_uid=cert.certificate_uid,
        credential_id=cert.credential_id or "",
        verification_code=verification_code(cert.signature),
        user_full_name=cert.user_full_name,
        course_title=cert.course_title,
        instructor_name=cert.instructor_name,
        completion_date=cert.completion_date,
        verification_url=verification_url(cert.certificate_uid, request),
        duration_hours=course.duration_hours if course else None,
        total_lectures=course.total_lectures if course else None,
    )


def render_qr(cert: Certificate, request=None) -> str:
    return render_qr_svg(verification_url(cert.certificate_uid, request))
