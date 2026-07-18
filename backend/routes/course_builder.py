"""
Course Builder routes — handles visual curriculum organization, module/lecture reordering, and status publishing.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from auth.oauth2 import get_current_user
from auth.permissions import require_permission, is_owner_or_admin
from models.user import User
from models.course import Course, Module, Lecture


router = APIRouter()


class LectureReorder(BaseModel):
    id: int
    order_index: int


class ModuleReorder(BaseModel):
    id: int
    order_index: int
    lectures: List[LectureReorder]


class CurriculumReorderRequest(BaseModel):
    modules: List[ModuleReorder]


class StatusUpdateRequest(BaseModel):
    is_published: bool


@router.get("/{course_id}/curriculum")
def get_curriculum(
    course_id: int,
    current_user: User = Depends(require_permission("course:edit")),
    db: Session = Depends(get_db),
):
    """Retrieve full curriculum hierarchy for reordering dashboard (owner/admin only)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this course")

    result = []
    for module in course.modules:
        m_dict = {
            "id": module.id,
            "title": module.title,
            "description": module.description,
            "order_index": module.order_index,
            "lectures": [
                {
                    "id": lecture.id,
                    "title": lecture.title,
                    "description": lecture.description,
                    "order_index": lecture.order_index,
                    "duration_seconds": lecture.duration_seconds,
                    "is_preview": lecture.is_preview,
                    "has_video": lecture.video is not None
                }
                for lecture in module.lectures
            ]
        }
        result.append(m_dict)
    return result


@router.put("/{course_id}/reorder")
def reorder_curriculum(
    course_id: int,
    data: CurriculumReorderRequest,
    current_user: User = Depends(require_permission("course:edit")),
    db: Session = Depends(get_db),
):
    """Updates order indices for course modules and child lectures (owner/admin only)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this course")

    # Bulk update order indices
    for mod_data in data.modules:
        module = db.query(Module).filter(Module.id == mod_data.id, Module.course_id == course_id).first()
        if module:
            module.order_index = mod_data.order_index
            
            # Map and update lectures order and assignment to module
            for lect_data in mod_data.lectures:
                lecture = db.query(Lecture).filter(Lecture.id == lect_data.id).first()
                if lecture:
                    lecture.module_id = module.id
                    lecture.order_index = lect_data.order_index
                    
    db.commit()
    return {"message": "Curriculum reordered successfully"}


@router.patch("/courses/{course_id}/status")
def update_course_status(
    course_id: int,
    data: StatusUpdateRequest,
    current_user: User = Depends(require_permission("course:publish")),
    db: Session = Depends(get_db),
):
    """Toggle course draft/published status (owner/admin only)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not is_owner_or_admin(course.instructor_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this course status")

    course.is_published = data.is_published
    db.commit()
    
    return {
        "message": f"Course status updated to {'published' if data.is_published else 'draft'}",
        "is_published": course.is_published
    }
