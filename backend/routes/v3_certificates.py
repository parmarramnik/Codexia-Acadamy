"""
Verifiable Credentials & Certificate Verification routes v3.0
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from models.certificate import Certificate
from models.v3_models import CertificateDownload

router = APIRouter(prefix="/certificates", tags=["Certificates Platform"])


@router.get("/verify/{uid}")
def verify_certificate_public(uid: str, db: Session = Depends(get_db)):
    """
    Verify a student certificate by its unique certificate_uid.
    Accessible publicly without requiring user login.
    """
    certificate = db.query(Certificate).filter(
        Certificate.certificate_uid == uid,
        Certificate.is_valid == True
    ).first()
    
    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Verifiable credential certificate not found or has been revoked."
        )
        
    return {
        "status": "VERIFIED",
        "certificate_uid": certificate.certificate_uid,
        "recipient": certificate.user_full_name,
        "course_title": certificate.course_title,
        "instructor": certificate.instructor_name,
        "completion_date": certificate.completion_date,
        "created_at": certificate.created_at,
        "issue_authority": "Codexia Academy International",
        "qr_code_url": certificate.qr_code_url
    }


@router.post("/{uid}/log-download")
def log_certificate_download(
    uid: str,
    request: Request,
    user_id: int = None,  # optional if logged in
    db: Session = Depends(get_db)
):
    """
    Log an entry in the certificate download audit log when a student downloads their credential.
    """
    certificate = db.query(Certificate).filter(Certificate.certificate_uid == uid).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
        
    log = CertificateDownload(
        certificate_id=certificate.id,
        user_id=user_id,
        ip_address=request.client.host if request.client else "unknown"
    )
    db.add(log)
    db.commit()
    
    return {"status": "download_logged"}
