"""
Course routes — CRUD, enrollment, course listing with filters.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.orm import Session
import os

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_role, is_owner_or_admin
from models.user import User, UserRole
from schemas.course import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListResponse,
    ModuleCreate, ModuleResponse, LectureCreate, LectureResponse,
    EnrollmentResponse,
)
from schemas.user import MessageResponse
from services import course_service
from services.audit_service import log_audit_event
from config import settings
from utils.helpers import generate_unique_filename, ensure_directory

router = APIRouter()


@router.get("/instructor/me", response_model=dict)
def list_my_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """List all courses created by the current instructor."""
    result = course_service.list_courses(
        db, page, page_size, instructor_id=current_user.id, published_only=False
    )
    items = []
    for course in result.items:
        course_dict = CourseListResponse.model_validate(course).model_dump()
        course_dict["instructor_name"] = course.instructor.full_name if course.instructor else ""
        course_dict["enrollment_count"] = course_service.get_enrollment_count(db, course.id)
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
                "price": c.price,
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
    result = course_service.list_courses(
        db, page, page_size, category, difficulty, search, published_only=True
    )
    items = []
    for course in result.items:
        course_dict = CourseListResponse.model_validate(course).model_dump()
        course_dict["instructor_name"] = course.instructor.full_name if course.instructor else ""
        course_dict["enrollment_count"] = course_service.get_enrollment_count(db, course.id)
        items.append(course_dict)
    return {**result.to_dict(), "items": items}


@router.post("", response_model=CourseResponse)
def create_course(
    data: CourseCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Create a new course (instructor or admin)."""
    course = course_service.create_course(db, data, current_user)
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
    if course_id_or_slug.isdigit():
        course = course_service.get_course_by_id(db, int(course_id_or_slug))
    else:
        course = course_service.get_course_by_slug(db, course_id_or_slug)

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _build_course_response(db, course)


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
    return course_service.enroll_student(db, current_user.id, course_id)


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
    db: Session = Depends(get_db),
):
    """Get all modules and lectures for a course."""
    modules = course_service.get_course_modules(db, course_id)
    result = []
    for module in modules:
        module_dict = ModuleResponse.model_validate(module).model_dump()
        module_dict["lectures"] = [
            {**LectureResponse.model_validate(l).model_dump(), "has_video": l.video is not None}
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
    return course_service.create_module(db, course_id, data)


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
    response["enrollment_count"] = course_service.get_enrollment_count(db, course.id)
    return response
