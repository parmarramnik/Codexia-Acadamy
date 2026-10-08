"""
Lecture routes — video upload, progress tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy.orm import Session
import mimetypes
import os
import re

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import is_owner_or_admin
from models.user import User
from models.course import Lecture, Module
from models.content import Video
from utils import media_access
from pydantic import BaseModel
from schemas.course import LectureCreate, LectureUpdate, LectureResponse, ProgressUpdate
from schemas.user import MessageResponse
from services import course_service, analytics_service
from config import settings
from utils.helpers import generate_unique_filename, ensure_directory
from utils.cache import cache_invalidate_prefix, invalidate_learner_cache

router = APIRouter()


class VideoUrlRequest(BaseModel):
    video_url: str


@router.post("/modules/{module_id}", response_model=LectureResponse)
def create_lecture(
    module_id: int,
    data: LectureCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new lecture in a module."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    course = course_service.get_course_by_id(db, module.course_id)
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    lecture = course_service.create_lecture(db, module_id, data)
    cache_invalidate_prefix("courses")
    return {
        **LectureResponse.model_validate(lecture).model_dump(),
        "has_video": lecture.video is not None,
        "video_url": lecture.video.file_url if lecture.video else None,
    }


@router.put("/{lecture_id}", response_model=LectureResponse)
def update_lecture(
    lecture_id: int,
    data: LectureUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a lecture (owner or admin only)."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course = course_service.get_course_by_id(db, module.course_id) if module else None
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = course_service.update_lecture(db, lecture, data)
    cache_invalidate_prefix("courses")
    return {
        **LectureResponse.model_validate(updated).model_dump(),
        "has_video": updated.video is not None,
        "video_url": updated.video.file_url if updated.video else None,
    }


@router.delete("/{lecture_id}", response_model=MessageResponse)
def delete_lecture(
    lecture_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a lecture (owner or admin only)."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course = course_service.get_course_by_id(db, module.course_id) if module else None
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    course_service.delete_lecture(db, lecture)
    cache_invalidate_prefix("courses")
    return {"message": "Lecture deleted successfully"}


@router.post("/{lecture_id}/video-url", response_model=MessageResponse)
def attach_video_url(
    lecture_id: int,
    data: VideoUrlRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach or update a streaming/direct video URL to a lecture."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course = course_service.get_course_by_id(db, module.course_id) if module else None
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    url = data.video_url.strip()
    if media_access.is_stream_url(url):
        # A signed playback link echoed back from the player: the stored source is unchanged.
        return {"message": "Video URL unchanged"}
    existing_video = db.query(Video).filter(Video.lecture_id == lecture_id).first()
    if existing_video:
        existing_video.file_url = url
        existing_video.file_name = f"Video - {lecture.title}"
    else:
        video = Video(
            lecture_id=lecture_id,
            file_url=url,
            file_name=f"Video - {lecture.title}",
            duration_seconds=lecture.duration_seconds,
            mime_type="video/mp4",
        )
        db.add(video)
    db.commit()
    cache_invalidate_prefix("courses")
    return {"message": "Video URL attached successfully"}


@router.delete("/{lecture_id}/video", response_model=MessageResponse)
def remove_lecture_video(
    lecture_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove video (link or uploaded file) from a lecture (owner or admin only)."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course = course_service.get_course_by_id(db, module.course_id) if module else None
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this lecture's video")

    video = db.query(Video).filter(Video.lecture_id == lecture_id).first()
    if video:
        db.delete(video)
        db.commit()
    cache_invalidate_prefix("courses")
    return {"message": "Video removed from lecture successfully"}


@router.post("/{lecture_id}/video")
async def upload_video(
    lecture_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a video to a lecture."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course = course_service.get_course_by_id(db, module.course_id) if module else None
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed = {"mp4", "webm", "mov", "avi"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Invalid video format")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "videos")
    ensure_directory(upload_dir)
    filename = generate_unique_filename(file.filename)
    filepath = os.path.join(upload_dir, filename)

    content = await file.read()
    file_size_mb = len(content) // (1024 * 1024)

    if file_size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(status_code=400, detail="File size exceeds limit")

    with open(filepath, "wb") as f:
        f.write(content)

    # Update or create video record
    existing_video = db.query(Video).filter(Video.lecture_id == lecture_id).first()
    if existing_video:
        existing_video.file_url = f"/static/videos/{filename}"
        existing_video.file_name = file.filename
        existing_video.file_size_mb = file_size_mb
        existing_video.mime_type = file.content_type or "video/mp4"
    else:
        video = Video(
            lecture_id=lecture_id,
            file_url=f"/static/videos/{filename}",
            file_name=file.filename,
            file_size_mb=file_size_mb,
            mime_type=file.content_type or "video/mp4",
        )
        db.add(video)

    db.commit()
    # The stored source path is returned to the course editor (owner/admin only) so the edit form
    # keeps it; learners only ever receive signed stream URLs.
    return {"message": "Video uploaded successfully", "file_url": f"/static/videos/{filename}"}


_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")
_STREAM_CHUNK = 1024 * 1024


def _iter_file_range(path: str, start: int, length: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            chunk = f.read(min(_STREAM_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/{lecture_id}/stream", include_in_schema=False)
def stream_lecture_video(
    lecture_id: int,
    request: Request,
    uid: int = Query(..., ge=0),
    exp: int = Query(...),
    sig: str = Query(..., min_length=64, max_length=64),
    db: Session = Depends(get_db),
):
    """Serve an uploaded lecture video via a signed, expiring URL; course access is re-checked every time."""
    if not media_access.verify_stream_signature(lecture_id, uid, exp, sig):
        raise HTTPException(status_code=403, detail="This video link is invalid or has expired. Reload the lecture.")
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    video = db.query(Video).filter(Video.lecture_id == lecture_id).first() if lecture else None
    if not video or not media_access.is_uploaded_video(video.file_url):
        raise HTTPException(status_code=404, detail="Video not found")
    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course = course_service.get_course_by_id(db, module.course_id) if module else None
    if not course:
        raise HTTPException(status_code=404, detail="Video not found")
    viewer = db.query(User).filter(User.id == uid, User.is_active == True).first() if uid else None
    if not media_access.can_watch_lecture(db, course, lecture, viewer):
        raise HTTPException(status_code=403, detail="Purchase this course to watch this lecture.")

    videos_dir = os.path.realpath(os.path.join(os.path.dirname(os.path.dirname(__file__)), settings.UPLOAD_DIR, "videos"))
    path = os.path.realpath(os.path.join(videos_dir, os.path.basename(video.file_url)))
    if os.path.dirname(path) != videos_dir or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Video not found")

    media_type = video.mime_type or mimetypes.guess_type(path)[0] or "video/mp4"
    size = os.path.getsize(path)
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, no-store"}
    range_header = request.headers.get("range")
    if not range_header:
        return FileResponse(path, media_type=media_type, headers=headers)

    match = _RANGE_RE.match(range_header.strip())
    if not match or match.group(1) == match.group(2) == "":
        return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
    if match.group(1) == "":
        start, end = max(0, size - int(match.group(2))), size - 1  # suffix range: last N bytes
    else:
        start = int(match.group(1))
        end = min(int(match.group(2)), size - 1) if match.group(2) else size - 1
    if start >= size or start > end:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
    length = end - start + 1
    return StreamingResponse(
        _iter_file_range(path, start, length), status_code=206, media_type=media_type,
        headers={**headers, "Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(length)},
    )


@router.patch("/{lecture_id}/progress", response_model=MessageResponse)
def update_progress(
    lecture_id: int,
    data: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update watch progress for a lecture."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    analytics_service.update_lecture_progress(
        db, current_user.id, lecture_id,
        data.watch_percentage, data.last_position_seconds,
    )
    invalidate_learner_cache(current_user.id)
    return {"message": "Progress updated"}
