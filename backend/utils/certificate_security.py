"""
Certificate identity, integrity and public-URL helpers.

- credential IDs: short, human-readable, unguessable public numbers (CDX-2026-7KQ2-M9XA)
- signatures: HMAC-SHA256 over the issued data, so edited DB rows fail verification
- public URLs: verification links always point at the deployed frontend, never localhost
"""

import hashlib
import hmac
import secrets
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from config import settings

# Crockford base32 alphabet (no I, L, O, U — avoids misreading when typed by hand)
_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}


def new_credential_id(issued: Optional[datetime] = None) -> str:
    year = (issued or datetime.utcnow()).year
    body = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"CDX-{year}-{body[:4]}-{body[4:]}"


def normalize_identifier(value: str) -> str:
    """Accepts a UUID or a credential ID typed in any case/spacing."""
    value = (value or "").strip()
    if value.upper().startswith("CDX"):
        return value.upper().replace(" ", "")
    return value.lower()


def _signing_key() -> bytes:
    return (settings.CERTIFICATE_SIGNING_KEY or settings.JWT_SECRET_KEY).encode("utf-8")


def _canonical_date(value) -> str:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None, microsecond=0).isoformat()
    return str(value or "")


def sign_certificate(cert) -> str:
    payload = "|".join([
        "v1",
        str(cert.certificate_uid),
        str(cert.credential_id or ""),
        str(cert.user_id),
        str(cert.course_id),
        (cert.user_full_name or "").strip(),
        (cert.course_title or "").strip(),
        (cert.instructor_name or "").strip(),
        _canonical_date(cert.completion_date),
    ])
    return hmac.new(_signing_key(), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def signature_is_valid(cert) -> bool:
    if not cert.signature:
        return False
    return hmac.compare_digest(cert.signature, sign_certificate(cert))


def verification_code(signature: Optional[str]) -> str:
    """Short code printed on the certificate and shown on the verification page."""
    if not signature:
        return ""
    s = signature[:16].upper()
    return "-".join(s[i:i + 4] for i in range(0, 16, 4))


def _is_local(url: str) -> bool:
    try:
        return (urlparse(url).hostname or "") in _LOCAL_HOSTS
    except Exception:
        return True


def _origin_of(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        p = urlparse(url)
        if p.scheme in ("http", "https") and p.netloc:
            return f"{p.scheme}://{p.netloc}"
    except Exception:
        pass
    return None


def _is_trusted_frontend(origin: str) -> bool:
    from middleware.cors import trusted_origin
    return trusted_origin(origin)


def public_frontend_url(request=None) -> str:
    """
    Origin of the public frontend used in QR codes and verification links.

    1. FRONTEND_URL when it is a real (non-localhost) address — the production setting.
    2. Otherwise the Origin/Referer of the calling page, but only if it is a trusted
       frontend origin (same allow-list as CORS), so the QR still points to the live
       site when FRONTEND_URL was left at its localhost default on the server.
    3. Otherwise FRONTEND_URL as-is (local development).
    """
    configured = (settings.FRONTEND_URL or "").strip().rstrip("/")
    if configured and not _is_local(configured):
        return configured

    if request is not None:
        for header in ("origin", "referer"):
            origin = _origin_of(request.headers.get(header))
            if origin and not _is_local(origin) and _is_trusted_frontend(origin):
                return origin

    return configured or "http://localhost:3000"


def verification_url(certificate_uid: str, request=None) -> str:
    return f"{public_frontend_url(request)}/verify/{certificate_uid}"
