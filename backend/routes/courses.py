"""
Course routes — CRUD, enrollment, course listing with filters.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.orm import Session
import os

from database import get_db
from auth.oauth2 import get_current_user, get_current_user_optional, oauth2_scheme_optional
from auth.permissions import require_role, is_owner_or_admin
from models.user import User, UserRole
from schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListResponse,
    ModuleCreate, ModuleUpdate, ModuleResponse, LectureCreate, LectureResponse,
    EnrollmentResponse,
)
from schemas.user import MessageResponse
from services import course_service
from services.audit_service import log_audit_event
from config import settings
from utils.helpers import generate_unique_filename, ensure_directory
from utils.cache import cache_get, cache_set, cache_invalidate_prefix, invalidate_learner_cache
from utils import media_access

router = APIRouter()


@router.get("/instructor/me", response_model=dict)
def list_my_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """List all courses created by the current instructor (or all if admin)."""
    instructor_id = None if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN) else current_user.id
    result = course_service.list_courses(
        db, page, page_size, instructor_id=instructor_id, published_only=False
    )
    course_ids = [c.id for c in result.items]
    enrollment_counts = {}
    if course_ids:
        from models.course import Enrollment
        from sqlalchemy import func
        counts = db.query(Enrollment.course_id, func.count(Enrollment.id)).filter(Enrollment.course_id.in_(course_ids)).group_by(Enrollment.course_id).all()
        enrollment_counts = {cid: cnt for cid, cnt in counts}

    items = []
    for course in result.items:
        course_dict = CourseListResponse.model_validate(course).model_dump()
        course_dict["instructor_name"] = course.instructor.full_name if course.instructor else ""
        course_dict["enrollment_count"] = enrollment_counts.get(course.id, 0)
        course_dict["is_published"] = course.is_published
        course_dict["is_approved"] = course.is_approved
        items.append(course_dict)
    return {**result.to_dict(), "items": items}


@router.get("/enrolled/me", response_model=list)
def list_my_enrollments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all courses enrolled by the current student."""
    enrollments = course_service.get_user_enrollments(db, current_user.id)
    result = []
    for e in enrollments:
        c = e.course
        result.append({
            "id": e.id,
            "user_id": e.user_id,
            "course_id": e.course_id,
            "enrolled_at": e.enrolled_at.isoformat(),
            "completion_percentage": e.completion_percentage,
            "is_active": e.is_active,
            "course": {
                "id": c.id,
                "title": c.title,
                "slug": c.slug,
                "short_description": c.short_description,
                "thumbnail_url": c.thumbnail_url,
                "instructor_name": c.instructor.full_name if c.instructor else "",
                "category": c.category,
                "difficulty": c.difficulty,
                "duration_hours": c.duration_hours,
                "total_lectures": c.total_lectures,
                "price": c.price if c.is_paid else 0.0,
            }
        })
    return result


@router.get("", response_model=dict)
def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List published and approved courses with filtering."""
    cache_key = f"courses:list:{page}:{page_size}:{category or 'all'}:{difficulty or 'all'}:{search or 'all'}"
    cached_payload = cache_get(cache_key)
    if cached_payload is not None:
        return cached_payload

    result = course_service.list_courses(
        db, page, page_size, category, difficulty, search, published_only=True
    )
    course_ids = [c.id for c in result.items]
    enrollment_counts = {}
    if course_ids:
        from models.course import Enrollment
        from sqlalchemy import func
        counts = db.query(Enrollment.course_id, func.count(Enrollment.id)).filter(Enrollment.course_id.in_(course_ids)).group_by(Enrollment.course_id).all()
        enrollment_counts = {cid: cnt for cid, cnt in counts}

    items = []
    for course in result.items:
        course_dict = CourseListResponse.model_validate(course).model_dump()
        course_dict["instructor_name"] = course.instructor.full_name if course.instructor else ""
        course_dict["instructor_avatar_url"] = course.instructor.avatar_url if course.instructor else ""
        course_dict["enrollment_count"] = enrollment_counts.get(course.id, 0)
        items.append(course_dict)
    response_payload = {**result.to_dict(), "items": items}
    cache_set(cache_key, response_payload, ttl=300)
    return response_payload


@router.post("", response_model=CourseResponse)
def create_course(
    data: CourseCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Create a new course (instructor or admin)."""
    course = course_service.create_course(db, data, current_user)
    cache_invalidate_prefix("courses")
    log_audit_event(
        db, current_user.id, "create_course", "course", str(course.id),
        previous_value=None, new_value=course.title, request=request
    )
    return _build_course_response(db, course)


@router.get("/{course_id_or_slug}")
def get_course(
    course_id_or_slug: str,
    db: Session = Depends(get_db),
):
    """Get a course by ID or slug."""
    cache_key = f"courses:detail:{course_id_or_slug}"
    cached_course = cache_get(cache_key)
    if cached_course is not None:
        return cached_course

    if course_id_or_slug.isdigit():
        course = course_service.get_course_by_id(db, int(course_id_or_slug))
    else:
        course = course_service.get_course_by_slug(db, course_id_or_slug)

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course_data = _build_course_response(db, course)
    cache_set(cache_key, course_data, ttl=600)
    return course_data


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    data: CourseUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a course (owner or admin only)."""
    course = course_service.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this course")
    
    prev_title = course.title
    updated = course_service.update_course(db, course, data)
    cache_invalidate_prefix("courses")
    
    log_audit_event(
        db, current_user.id, "update_course", "course", str(course_id),
        previous_value=prev_title, new_value=updated.title, request=request
    )
    return _build_course_response(db, updated)


@router.delete("/{course_id}", response_model=MessageResponse)
def delete_course(
    course_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a course (owner or admin only)."""
    course = course_service.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    course_service.delete_course(db, course)
    cache_invalidate_prefix("courses")
    
    log_audit_event(
        db, current_user.id, "delete_course", "course", str(course_id),
        previous_value=course.title, new_value=None, request=request
    )
    return {"message": "Course deleted successfully"}


@router.patch("/{course_id}/approve", response_model=CourseResponse)
def approve_course(
    course_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Approve a course for publication (admin only)."""
    course = course_service.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    approved = course_service.approve_course(db, course)
    
    log_audit_event(
        db, current_user.id, "approve_course", "course", str(course_id),
        previous_value="unapproved", new_value="approved", request=request
    )
    return _build_course_response(db, approved)



@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
def enroll_in_course(
    course_id: int,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
    db: Session = Depends(get_db),
):
    """Enroll the current student in a course."""
    course = course_service.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.is_published or not course.is_approved:
        raise HTTPException(status_code=400, detail="Course is not available for enrollment")
    if course.is_paid:
        # Paid access is only ever granted by the verified payment flow (/api/payments).
        raise HTTPException(status_code=402, detail="This is a paid course. Please purchase it to enroll.")
    enrollment = course_service.enroll_student(db, current_user.id, course_id)
    invalidate_learner_cache(current_user.id)
    try:
        from services import analytics_service
        analytics_service.create_notification(
            db=db,
            user_id=current_user.id,
            title=f"Enrolled in {course.title}",
            message=f"You are now enrolled in '{course.title}'. Start your first module today!",
            notification_type="course_update",
            link=f"/courses/{course.slug}",
        )
        if course.instructor_id and course.instructor_id != current_user.id:
            analytics_service.create_notification(
                db=db,
                user_id=course.instructor_id,
                title="New Student Enrolled",
                message=f"{current_user.full_name} enrolled in your course '{course.title}'.",
                notification_type="info",
                link=f"/courses/{course.slug}",
            )
    except Exception:
        pass
    return enrollment


@router.get("/{course_id}/progress")
def get_course_progress(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the list of completed lecture IDs for a course by the current user."""
    from models.analytics import Progress
    from models.course import Lecture, Module

    completed = (
        db.query(Progress.lecture_id)
        .join(Lecture)
        .join(Module)
        .filter(
            Module.course_id == course_id,
            Progress.user_id == current_user.id,
            Progress.is_completed == True,
        )
        .all()
    )
    return [c[0] for c in completed]


@router.get("/{course_id}/modules", response_model=list[ModuleResponse])
def get_course_modules(
    course_id: int,
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
):
    """Get all modules and lectures for a course.

    For PAID courses, video URLs of non-preview lectures are only returned to enrolled
    learners, the course owner and admins. Uploaded video files are always returned as
    short-lived signed stream URLs (the raw /static/videos path is not publicly served).
    """
    modules = course_service.get_course_modules(db, course_id)
    course = course_service.get_course_by_id(db, course_id) if modules else None
    if not course:
        return []
    current_user = get_current_user_optional(token, db) if token else None
    is_paid = course.is_paid
    if is_paid and token and current_user is None:
        # Expired/invalid token: 401 lets the client refresh and retry instead of showing a locked course.
        raise HTTPException(status_code=401, detail="Could not validate credentials",
                            headers={"WWW-Authenticate": "Bearer"})
    can_view_paid = not is_paid or media_access.can_access_paid_content(db, course, current_user)
    is_editor = bool(current_user) and is_owner_or_admin(course.instructor_id, current_user)

    def playable_url(lecture):
        if not lecture.video or not (can_view_paid or lecture.is_preview):
            return None
        if media_access.is_uploaded_video(lecture.video.file_url):
            return media_access.signed_stream_path(lecture.id, current_user.id if current_user else None)
        return lecture.video.file_url

    result = []
    for module in modules:
        module_dict = ModuleResponse.model_validate(module).model_dump()
        module_dict["lectures"] = [
            {
                **LectureResponse.model_validate(l).model_dump(),
                "has_video": l.video is not None,
                "video_url": playable_url(l),
                # Raw stored source, for the course editors' "edit video" forms only.
                "source_url": l.video.file_url if (l.video and is_editor) else None,
                "locked": not (can_view_paid or l.is_preview),
            }
            for l in module.lectures
        ]
        result.append(module_dict)
    return result


@router.post("/{course_id}/modules", response_model=ModuleResponse)
def create_module(
    course_id: int,
    data: ModuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new module in a course."""
    course = course_service.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    created = course_service.create_module(db, course_id, data)
    cache_invalidate_prefix("courses")
    return created


@router.put("/modules/{module_id}", response_model=ModuleResponse)
def update_module(
    module_id: int,
    data: ModuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a module (owner or admin only)."""
    from models.course import Module
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    course = course_service.get_course_by_id(db, module.course_id)
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this module")
    updated = course_service.update_module(db, module, data)
    cache_invalidate_prefix("courses")
    return updated


@router.delete("/modules/{module_id}", response_model=MessageResponse)
def delete_module(
    module_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a module and its lectures (owner or admin only)."""
    from models.course import Module
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    course = course_service.get_course_by_id(db, module.course_id)
    if not course or not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to delete this module")
    course_service.delete_module(db, module)
    cache_invalidate_prefix("courses")
    return {"message": "Module deleted successfully"}


@router.post("/{course_id}/thumbnail", response_model=MessageResponse)
async def upload_thumbnail(
    course_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a course thumbnail image."""
    course = course_service.get_course_by_id(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed = {"jpg", "jpeg", "png", "webp"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Invalid image format")

    upload_dir = os.path.join(settings.UPLOAD_DIR, "thumbnails")
    ensure_directory(upload_dir)
    filename = generate_unique_filename(file.filename)
    filepath = os.path.join(upload_dir, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    course.thumbnail_url = f"/static/thumbnails/{filename}"
    db.commit()
    return {"message": "Thumbnail uploaded successfully"}


def _build_course_response(db: Session, course) -> dict:
    """Build a complete course response dict."""
    response = CourseResponse.model_validate(course).model_dump()
    response["instructor_name"] = course.instructor.full_name if course.instructor else ""
    response["instructor_avatar_url"] = course.instructor.avatar_url if course.instructor else ""
    response["instructor_bio"] = course.instructor.bio if course.instructor else ""
    response["enrollment_count"] = course_service.get_enrollment_count(db, course.id)
    return response
