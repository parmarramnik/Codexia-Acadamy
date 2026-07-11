"""
Lecture routes — video upload, progress tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import is_owner_or_admin
from models.user import User
from models.course import Lecture, Module
from models.content import Video
from schemas.course import LectureCreate, LectureResponse, ProgressUpdate
from schemas.user import MessageResponse
from services import course_service, analytics_service
from config import settings
from utils.helpers import generate_unique_filename, ensure_directory

router = APIRouter()


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
    return course_service.create_lecture(db, module_id, data)


@router.post("/{lecture_id}/video", response_model=MessageResponse)
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
    return {"message": "Video uploaded successfully"}


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
    return {"message": "Progress updated"}
