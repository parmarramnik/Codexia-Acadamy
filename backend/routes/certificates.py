"""
Certificate routes — issue, list, public verification, on-demand PDF and QR rendering.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role
from models.user import User, UserRole
from schemas.analytics import CertificateResponse, CertificateVerifyResponse
from services import certificate_service
from utils.cache import cache_get, cache_set, invalidate_learner_cache

router = APIRouter()


def _get_or_404(db: Session, identifier: str):
    cert = certificate_service.find_certificate(db, identifier)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found. Check the certificate ID and try again.")
    return cert


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
    res = [CertificateResponse.model_validate(c).model_dump(mode="json") for c in certs]
    cache_set(cache_key, res, ttl=600)
    return res


@router.post("/{course_id}/generate", response_model=CertificateResponse)
def generate_certificate(
    course_id: int,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """Issue a certificate for a completed course (server-side checks only)."""
    cert = certificate_service.generate_certificate(db, current_user.id, course_id)
    invalidate_learner_cache(current_user.id)
    return cert


@router.get("/{certificate_uid}/verify", response_model=CertificateVerifyResponse)
def verify_certificate(
    certificate_uid: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public verification by certificate UUID or credential ID.
    404 when no such certificate exists; otherwise `status` is VERIFIED, REVOKED or INTEGRITY_FAILED.
    """
    cert = _get_or_404(db, certificate_uid)
    return certificate_service.verification_payload(cert, request)


def _filename(cert) -> str:
    base = cert.credential_id or cert.certificate_uid
    return f"Codexia-Certificate-{re.sub(r'[^A-Za-z0-9-]', '', base)}.pdf"


@router.get("/{certificate_uid}/pdf")
def download_certificate_pdf(
    certificate_uid: str,
    request: Request,
    download: bool = False,
    db: Session = Depends(get_db),
):
    """Render the official PDF on demand from the stored record (public, like verification)."""
    cert = _get_or_404(db, certificate_uid)
    if certificate_service.verification_status(cert) != "VERIFIED":
        raise HTTPException(status_code=410, detail="This certificate is no longer valid and cannot be downloaded.")
    pdf_bytes = certificate_service.render_pdf(cert, request)
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{_filename(cert)}"',
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{certificate_uid}/qr.svg")
def certificate_qr(
    certificate_uid: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Scannable QR code (SVG) that opens the public verification page."""
    cert = _get_or_404(db, certificate_uid)
    return Response(
        content=certificate_service.render_qr(cert, request),
        media_type="image/svg+xml",
        headers={"Cache-Control": "private, max-age=600", "Vary": "Origin, Referer"},
    )
