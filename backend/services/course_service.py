"""
Course service — business logic for course, module, and lecture management.
"""

from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from models.course import Course, Module, Lecture, Enrollment, CourseCategory, CourseDifficulty
from models.content import Video
from models.user import User
from schemas.course import CourseCreate, CourseUpdate, ModuleCreate, LectureCreate
from utils.helpers import generate_slug, paginate_query, PaginatedResponse


def create_course(db: Session, data: CourseCreate, instructor: User) -> Course:
    """Create a new course."""
    slug = generate_slug(data.title)
    course = Course(
        title=data.title,
        slug=slug,
        description=data.description,
        short_description=data.short_description,
        instructor_id=instructor.id,
        category=data.category,
        difficulty=data.difficulty,
        tags=data.tags,
        prerequisites=data.prerequisites,
        learning_objectives=data.learning_objectives,
        price=data.price,
        is_published=False,
        is_approved=False,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def get_course_by_id(db: Session, course_id: int) -> Optional[Course]:
    """Fetch a course by ID with instructor info."""
    return (
        db.query(Course)
        .options(joinedload(Course.instructor))
        .filter(Course.id == course_id)
        .first()
    )


def get_course_by_slug(db: Session, slug: str) -> Optional[Course]:
    """Fetch a course by its URL slug."""
    return (
        db.query(Course)
        .options(joinedload(Course.instructor))
        .filter(Course.slug == slug)
        .first()
    )


def list_courses(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    instructor_id: Optional[int] = None,
    published_only: bool = True,
) -> PaginatedResponse:
    """List courses with filtering, search, and pagination."""
    query = db.query(Course).options(joinedload(Course.instructor))

    if published_only:
        query = query.filter(Course.is_published == True, Course.is_approved == True)
    if category:
        query = query.filter(Course.category == category)
    if difficulty:
        query = query.filter(Course.difficulty == difficulty)
    if instructor_id:
        query = query.filter(Course.instructor_id == instructor_id)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Course.title.ilike(search_term),
                Course.description.ilike(search_term),
                Course.tags.ilike(search_term),
            )
        )

    total = query.count()
    query = query.order_by(Course.created_at.desc())
    courses = paginate_query(query, page, page_size).all()

    return PaginatedResponse(items=courses, total=total, page=page, page_size=page_size)


def update_course(db: Session, course: Course, data: CourseUpdate) -> Course:
    """Update course fields."""
    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, course: Course) -> bool:
    """Delete a course and all related data."""
    db.delete(course)
    db.commit()
    return True


def approve_course(db: Session, course: Course) -> Course:
    """Admin approves a course for publication."""
    course.is_approved = True
    db.commit()
    db.refresh(course)
    return course


def enroll_student(db: Session, user_id: int, course_id: int) -> Enrollment:
    """Enroll a student in a course."""
    existing = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        .first()
    )
    if existing:
        if existing.is_active:
            raise ValueError("Already enrolled in this course")
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    enrollment = Enrollment(
        user_id=user_id,
        course_id=course_id,
        is_active=True,
        completion_percentage=0.0,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_enrollment(db: Session, user_id: int, course_id: int) -> Optional[Enrollment]:
    """Check if a user is enrolled in a course."""
    return (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == user_id,
            Enrollment.course_id == course_id,
            Enrollment.is_active == True,
        )
        .first()
    )


def get_user_enrollments(db: Session, user_id: int) -> List[Enrollment]:
    """Get all active enrollments for a user."""
    return (
        db.query(Enrollment)
        .options(joinedload(Enrollment.course).joinedload(Course.instructor))
        .filter(Enrollment.user_id == user_id, Enrollment.is_active == True)
        .all()
    )


def get_enrollment_count(db: Session, course_id: int) -> int:
    """Get the number of enrolled students for a course."""
    return (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course_id, Enrollment.is_active == True)
        .count()
    )


# --- Module operations ---

def create_module(db: Session, course_id: int, data: ModuleCreate) -> Module:
    """Create a new module in a course."""
    module = Module(
        course_id=course_id,
        title=data.title,
        description=data.description,
        order_index=data.order_index,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    _update_course_lecture_count(db, course_id)
    return module


def get_course_modules(db: Session, course_id: int) -> List[Module]:
    """Get all modules for a course, with their lectures."""
    return (
        db.query(Module)
        .options(joinedload(Module.lectures).joinedload(Lecture.video))
        .filter(Module.course_id == course_id)
        .order_by(Module.order_index)
        .all()
    )


# --- Lecture operations ---

def create_lecture(db: Session, module_id: int, data: LectureCreate) -> Lecture:
    """Create a new lecture in a module."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise ValueError("Module not found")

    lecture = Lecture(
        module_id=module_id,
        title=data.title,
        description=data.description,
        order_index=data.order_index,
        duration_seconds=data.duration_seconds,
        is_preview=data.is_preview,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    _update_course_lecture_count(db, module.course_id)
    return lecture


def _update_course_lecture_count(db: Session, course_id: int) -> None:
    """Recalculate the total lecture count for a course."""
    count = (
        db.query(Lecture)
        .join(Module)
        .filter(Module.course_id == course_id)
        .count()
    )
    course = db.query(Course).filter(Course.id == course_id).first()
    if course:
        course.total_lectures = count
        db.commit()


def get_course_stats(db: Session) -> dict:
    """Get course statistics for admin dashboard."""
    total = db.query(Course).count()
    published = db.query(Course).filter(Course.is_published == True).count()
    pending = db.query(Course).filter(
        Course.is_published == True, Course.is_approved == False
    ).count()
    total_enrollments = db.query(Enrollment).filter(Enrollment.is_active == True).count()

    return {
        "total_courses": total,
        "published_courses": published,
        "pending_approval": pending,
        "total_enrollments": total_enrollments,
    }
