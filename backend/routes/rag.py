"""
RAG document management for course owners and admins.

Students never call these: they ask questions through /api/ai/chat, which authorizes the
course (enrollment + verified payment) before retrieval.
"""

import hashlib
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ai.rag import embedder, service
from ai.rag.extract import ExtractionError
from auth.permissions import is_owner_or_admin, require_role
from config import settings
from database import SessionLocal, get_db
from middleware.rate_limiter import limiter
from models.course import Course
from models.rag import CourseDocument, DocumentStatus
from models.user import User, UserRole

logger = logging.getLogger("codexia.rag.routes")

router = APIRouter()


def _per_user_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    return "u:" + hashlib.sha256(auth.encode("utf-8")).hexdigest()[:24] if auth else "anon"


def _owned_course(db: Session, course_id: int, user: User) -> Course:
    course = db.query(Course).filter(Course.id == course_id).first()
    # 404 for both "missing" and "not yours" so course IDs cannot be probed.
    if course is None or not is_owner_or_admin(course.instructor_id, user):
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _owned_document(db: Session, doc_id: int, user: User) -> CourseDocument:
    doc = db.query(CourseDocument).filter(CourseDocument.id == doc_id).first()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    _owned_course(db, doc.course_id, user)
    return doc


def serialize(doc: CourseDocument) -> dict:
    return {
        "id": doc.id, "course_id": doc.course_id, "title": doc.title, "source_type": doc.source_type,
        "filename": doc.filename, "status": doc.status, "error": doc.error, "chunk_count": doc.chunk_count,
        "embedding_model": doc.embedding_model,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


def _ingest_in_background(doc_id: int) -> None:
    """Own DB session: the request's session is closed by the time this runs."""
    db = SessionLocal()
    try:
        service.process_document(db, doc_id)
    except Exception as exc:  # status + reason are already persisted on the document row
        logger.warning("Background ingestion of document %s failed: %s", doc_id, type(exc).__name__)
    finally:
        db.close()


@router.post("/courses/{course_id}/documents", status_code=202)
@limiter.limit("20/minute", key_func=_per_user_key)
async def upload_document(
    request: Request,
    course_id: int,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    course = _owned_course(db, course_id, current_user)
    # Read at most limit+1 bytes so an oversized upload is rejected without buffering all of it.
    limit = settings.RAG_MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    try:
        doc, created = service.ingest_upload(db, course, file.filename or "", data, current_user.id, file.content_type)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if not created and doc.status == DocumentStatus.READY.value:
        return {"duplicate": True, "document": serialize(doc)}
    if not created:  # same content was uploaded before but never finished: retry it
        service.reset_for_reingest(db, doc)
    background.add_task(_ingest_in_background, doc.id)
    return {"duplicate": False, "document": serialize(doc)}


@router.get("/courses/{course_id}/documents")
def list_documents(
    course_id: int,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    _owned_course(db, course_id, current_user)
    docs = db.query(CourseDocument).filter(CourseDocument.course_id == course_id).order_by(CourseDocument.id).all()
    return [serialize(d) for d in docs]


@router.post("/documents/{doc_id}/reindex", status_code=202)
def reindex_document(
    doc_id: int,
    background: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    doc = _owned_document(db, doc_id, current_user)
    if doc.status == DocumentStatus.PROCESSING.value:
        raise HTTPException(status_code=409, detail="This document is already being processed.")
    service.reset_for_reingest(db, doc)
    background.add_task(_ingest_in_background, doc.id)
    return serialize(doc)


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    current_user: User = Depends(require_role(UserRole.INSTRUCTOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    doc = _owned_document(db, doc_id, current_user)
    service.delete_document(db, doc)


@router.get("/health")
def rag_health(current_user: User = Depends(require_role(UserRole.ADMIN))):
    """Loads the embedding model (first call can take a while) and embeds one string."""
    return embedder.health()
