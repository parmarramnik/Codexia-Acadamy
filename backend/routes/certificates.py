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
from utils.cache import cache_get, cache_set, cache_invalidate_prefix

router = APIRouter()


@router.get("", response_model=list[CertificateResponse])
def get_my_certificates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all certificates for the current user."""
    cache_key = f"certificates:user:{current_user.id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    certs = certificate_service.get_user_certificates(db, current_user.id)
    res = [CertificateResponse.model_validate(c).model_dump() for c in certs]
    cache_set(cache_key, res, ttl=600)
    return res


@router.post("/{course_id}/generate", response_model=CertificateResponse)
def generate_certificate(
    course_id: int,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """Generate a certificate for a completed course."""
    cert = certificate_service.generate_certificate(db, current_user.id, course_id)
    cache_invalidate_prefix(f"certificates:user:{current_user.id}")
    return cert


@router.get("/{certificate_uid}/verify", response_model=CertificateVerifyResponse)
def verify_certificate(
    certificate_uid: str,
    db: Session = Depends(get_db),
):
    """Verify a certificate by its unique ID (public endpoint)."""
    cache_key = f"certificates:verify:{certificate_uid}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    cert = certificate_service.verify_certificate(db, certificate_uid)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid")
    res = CertificateVerifyResponse.model_validate(cert).model_dump()
    cache_set(cache_key, res, ttl=1800)
    return res
