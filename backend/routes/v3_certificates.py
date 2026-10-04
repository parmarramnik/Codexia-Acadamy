"""
Verifiable Credentials & Certificate Verification routes v3.0
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user_optional
from models.v3_models import CertificateDownload
from services import certificate_service

router = APIRouter(prefix="/certificates", tags=["Certificates Platform"])


@router.get("/verify/{uid}")
def verify_certificate_public(uid: str, request: Request, db: Session = Depends(get_db)):
    """
    Verify a certificate by its certificate_uid or credential ID.
    Accessible publicly without requiring user login.
    """
    certificate = certificate_service.find_certificate(db, uid)
    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Verifiable credential certificate not found or has been revoked."
        )

    payload = certificate_service.verification_payload(certificate, request)
    # Legacy field names kept for existing clients
    payload.update({
        "recipient": certificate.user_full_name,
        "instructor": certificate.instructor_name,
        "created_at": certificate.created_at,
        "issue_authority": "Codexia Academy International",
        "qr_code_url": certificate_service.pdf_path(certificate.certificate_uid).replace("/pdf", "/qr.svg"),
    })
    return payload


@router.post("/{uid}/log-download")
def log_certificate_download(
    uid: str,
    request: Request,
    current_user=Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Log an entry in the certificate download audit log when a credential is downloaded.
    """
    certificate = certificate_service.find_certificate(db, uid)
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    log = CertificateDownload(
        certificate_id=certificate.id,
        user_id=current_user.id if current_user else None,
        ip_address=request.client.host if request.client else "unknown"
    )
    db.add(log)
    db.commit()

    return {"status": "download_logged"}
