"""
Course service — business logic for course, module, and lecture management.
"""

from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from models.course import Course, Module, Lecture, Enrollment, CourseCategory, CourseDifficulty
from models.content import Video
from models.user import User
from schemas.course import CourseCreate, CourseUpdate, ModuleCreate, ModuleUpdate, LectureCreate, LectureUpdate
from utils.helpers import generate_slug, paginate_query, PaginatedResponse
from utils.media_access import is_stream_url


def create_course(db: Session, data: CourseCreate, instructor: User) -> Course:
    """Create a new course."""
    slug = generate_slug(data.title)
    course = Course(
        title=data.title,
        slug=slug,
        description=data.description,
        short_description=data.short_description,
        thumbnail_url=data.thumbnail_url,
        instructor_id=instructor.id,
        category=data.category,
        difficulty=data.difficulty,
        tags=data.tags,
        prerequisites=data.prerequisites,
        learning_objectives=data.learning_objectives,
        # Courses always start FREE; only admins set live pricing (see services/pricing_service.py).
        price=0.0,
        pricing_type="FREE",
        price_amount=0,
        currency="INR",
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
        es_matched = False
        try:
            from utils.elasticsearch_client import is_es_available, get_es_client, INDEX_COURSES
            if is_es_available():
                client = get_es_client()
                es_res = client.search(
                    index=INDEX_COURSES,
                    body={
                        "query": {
                            "multi_match": {
                                "query": search.strip(),
                                "fields": ["title^4", "tags^2", "short_description", "description", "instructor_name"],
                                "fuzziness": "AUTO"
                            }
                        },
                        "_source": ["id"],
                        "size": 100
                    }
                )
                hits = es_res.get("hits", {}).get("hits", [])
                ids = [int(h["_source"]["id"]) for h in hits if h.get("_source", {}).get("id")]
                query = query.filter(Course.id.in_(ids) if ids else Course.id == -1)
                es_matched = True
        except Exception:
            pass

        if not es_matched:
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
    """Update course fields. Pricing is never changed here — it is admin-controlled via /api/pricing."""
    update_dict = data.model_dump(exclude_unset=True)
    update_dict.pop("price", None)
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


def update_module(db: Session, module: Module, data: ModuleUpdate) -> Module:
    """Update module details."""
    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)
    return module


def delete_module(db: Session, module: Module) -> bool:
    """Delete a module and all its associated lectures."""
    course_id = module.course_id
    db.delete(module)
    db.commit()
    _update_course_lecture_count(db, course_id)
    return True


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
    """Create a new lecture in a module with optional video URL."""
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
    db.flush()

    if data.video_url and data.video_url.strip():
        video = Video(
            lecture_id=lecture.id,
            file_url=data.video_url.strip(),
            file_name=f"Video - {data.title}",
            duration_seconds=data.duration_seconds,
            mime_type="video/mp4",
        )
        db.add(video)

    db.commit()
    db.refresh(lecture)
    _update_course_lecture_count(db, module.course_id)
    return lecture


def update_lecture(db: Session, lecture: Lecture, data: LectureUpdate) -> Lecture:
    """Update lecture details and associated video URL."""
    update_dict = data.model_dump(exclude_unset=True)
    video_url = update_dict.pop("video_url", None)
    if is_stream_url(video_url):
        video_url = None  # A signed playback link echoed back by an edit form: keep the stored source

    for field, value in update_dict.items():
        setattr(lecture, field, value)

    if video_url is not None:
        clean_url = video_url.strip()
        existing_video = db.query(Video).filter(Video.lecture_id == lecture.id).first()
        if existing_video:
            if clean_url:
                existing_video.file_url = clean_url
                existing_video.duration_seconds = lecture.duration_seconds
            else:
                db.delete(existing_video)
        elif clean_url:
            new_video = Video(
                lecture_id=lecture.id,
                file_url=clean_url,
                file_name=f"Video - {lecture.title}",
                duration_seconds=lecture.duration_seconds,
                mime_type="video/mp4",
            )
            db.add(new_video)

    db.commit()
    db.refresh(lecture)
    return lecture


def delete_lecture(db: Session, lecture: Lecture) -> bool:
    """Delete a lecture and associated video/progress records."""
    module = db.query(Module).filter(Module.id == lecture.module_id).first()
    course_id = module.course_id if module else None
    db.delete(lecture)
    db.commit()
    if course_id:
        _update_course_lecture_count(db, course_id)
    return True


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
