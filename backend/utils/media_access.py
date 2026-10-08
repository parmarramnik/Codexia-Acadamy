"""
Protected delivery of uploaded lecture videos.

Uploaded files live under static/videos but are NOT served by the public /static mount.
Players get a short-lived signed URL (/api/lectures/{id}/stream?...) from the modules
endpoint, and the stream endpoint re-checks course access on every request, so a paid
video cannot be fetched without a verified purchase (or by replaying an old link after
a refund once it expires).
"""

import hashlib
import hmac
import re
import time
from typing import Optional
from urllib.parse import urlencode

from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles

from config import settings

UPLOADED_VIDEO_PREFIX = "/static/videos/"
STREAM_URL_TTL_SECONDS = 6 * 60 * 60
_STREAM_URL_RE = re.compile(r"/api/lectures/\d+/stream\b")


class PublicStaticFiles(StaticFiles):
    """The public /static mount, minus uploaded lecture videos (served only via the signed stream route)."""

    async def get_response(self, path: str, scope):
        first_segment = path.replace("\\", "/").lstrip("/").split("/", 1)[0]
        if first_segment.lower() == "videos":
            raise HTTPException(status_code=404)
        return await super().get_response(path, scope)


def is_uploaded_video(url: Optional[str]) -> bool:
    return bool(url) and url.startswith(UPLOADED_VIDEO_PREFIX)


def is_stream_url(url: Optional[str]) -> bool:
    """True for URLs this API minted; they must never be stored back as a lecture's source."""
    return bool(url) and bool(_STREAM_URL_RE.search(url))


def _signing_key() -> bytes:
    # Derived from the JWT secret so no extra secret is needed; domain-separated from JWTs.
    return hashlib.sha256(b"lecture-stream-v1:" + settings.JWT_SECRET_KEY.encode("utf-8")).digest()


def _signature(lecture_id: int, user_id: int, expires: int) -> str:
    msg = f"{lecture_id}:{user_id}:{expires}".encode("utf-8")
    return hmac.new(_signing_key(), msg, hashlib.sha256).hexdigest()


def signed_stream_path(lecture_id: int, user_id: Optional[int]) -> str:
    """Relative API path; the frontend prefixes the backend origin (Render), never its own (Vercel)."""
    uid = int(user_id or 0)
    expires = int(time.time()) + STREAM_URL_TTL_SECONDS
    query = urlencode({"uid": uid, "exp": expires, "sig": _signature(lecture_id, uid, expires)})
    return f"{settings.API_PREFIX}/lectures/{lecture_id}/stream?{query}"


def verify_stream_signature(lecture_id: int, user_id: int, expires: int, signature: str) -> bool:
    if expires < int(time.time()):
        return False
    return hmac.compare_digest(_signature(lecture_id, user_id, expires), signature or "")


def can_access_paid_content(db: Session, course, user) -> bool:
    """Enrolled learners, the course owner and admins can watch non-preview lectures of a paid course."""
    if user is None:
        return False
    from auth.permissions import is_owner_or_admin
    from services.course_service import get_enrollment
    return is_owner_or_admin(course.instructor_id, user) or get_enrollment(db, user.id, course.id) is not None


def can_watch_lecture(db: Session, course, lecture, user) -> bool:
    if not course.is_paid or lecture.is_preview:
        return True  # Free courses and preview lectures keep their previous open access
    return can_access_paid_content(db, course, user)
