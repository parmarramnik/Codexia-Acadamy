"""
Certificate routes — generate, list, QR verification.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role
from models.user import User, UserRole
from schemas.analytics import CertificateResponse, CertificateVerifyResponse
from services import certificate_service

router = APIRouter()


@router.get("", response_model=list[CertificateResponse])
def get_my_certificates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all certificates for the current user."""
    return certificate_service.get_user_certificates(db, current_user.id)


@router.post("/{course_id}/generate", response_model=CertificateResponse)
def generate_certificate(
    course_id: int,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """Generate a certificate for a completed course."""
    return certificate_service.generate_certificate(db, current_user.id, course_id)


@router.get("/{certificate_uid}/verify", response_model=CertificateVerifyResponse)
def verify_certificate(
    certificate_uid: str,
    db: Session = Depends(get_db),
):
    """Verify a certificate by its unique ID (public endpoint)."""
    cert = certificate_service.verify_certificate(db, certificate_uid)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid")
    return cert
