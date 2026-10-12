"""
RAG service: ingestion, retrieval and context construction.

Runtime flow for a course question (see routes/ai.py):
  authenticate -> authorize_course_access (enrollment + verified payment) -> classify query
  -> embed query -> FAISS search of THAT course only -> relevance threshold, dedupe, per-document
  cap, context budget -> grounded prompt with numbered sources -> LLM -> citation check.
"""

import hashlib
import logging
import re
import threading
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session, joinedload

from ai.rag import chunking, embedder, index
from ai.rag.extract import ExtractionError, extract_text, normalize_text
from config import settings
from models.course import Course, Module
from models.rag import CourseDocument, DocumentChunk, DocumentSource, DocumentStatus

logger = logging.getLogger("codexia.rag")

_course_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


def _course_lock(course_id: int) -> threading.Lock:
    with _locks_guard:
        return _course_locks.setdefault(course_id, threading.Lock())


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- ingestion

def _embed_chunks(text: str) -> tuple[list[chunking.Chunk], np.ndarray]:
    chunks = chunking.chunk_text(text)
    if not chunks:
        raise ExtractionError("The document has no content to index.")
    vectors = embedder.embed_texts([c.text for c in chunks])
    if vectors.shape[0] != len(chunks):
        raise RuntimeError("Embedding count does not match chunk count.")
    return chunks, vectors


def _store(db: Session, doc: CourseDocument, chunks: list[chunking.Chunk], vectors: np.ndarray) -> None:
    """Swap a document's chunks atomically: old rows are replaced only once new vectors exist."""
    emb = embedder.get_embedder()
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
    for chunk, vector in zip(chunks, vectors):
        db.add(DocumentChunk(document_id=doc.id, course_id=doc.course_id, chunk_index=chunk.index,
                             section=chunk.section, text=chunk.text,
                             embedding=np.asarray(vector, dtype=np.float32).tobytes()))
    doc.chunk_count = len(chunks)
    doc.embedding_model = emb.model_name
    doc.embedding_dim = emb.dim
    doc.status = DocumentStatus.READY.value
    doc.error = None
    db.commit()  # one transaction: failure leaves the previous chunks untouched
    index.invalidate(doc.course_id)


def _fail(db: Session, doc_id: int, message: str) -> None:
    db.rollback()
    doc = db.query(CourseDocument).filter(CourseDocument.id == doc_id).first()
    if doc is not None:
        doc.status = DocumentStatus.FAILED.value
        doc.error = message[:500]
        db.commit()


def process_document(db: Session, doc_id: int) -> CourseDocument:
    """Chunk + embed + store one document. Marks it FAILED (with a reason) instead of reporting false success."""
    doc = db.query(CourseDocument).filter(CourseDocument.id == doc_id).first()
    if doc is None:
        raise LookupError("Document not found")
    course_id = doc.course_id
    with _course_lock(course_id):
        doc.status = DocumentStatus.PROCESSING.value
        doc.error = None
        db.commit()
        try:
            chunks, vectors = _embed_chunks(doc.text or "")
            _store(db, doc, chunks, vectors)
        except ExtractionError as exc:
            _fail(db, doc_id, str(exc))
            raise
        except embedder.EmbeddingUnavailable as exc:
            _fail(db, doc_id, str(exc))
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("Ingestion of document %s failed", doc_id)
            _fail(db, doc_id, "Indexing failed unexpectedly. Please retry.")
            raise RuntimeError("Indexing failed") from exc
    db.refresh(doc)
    return doc


def create_document(db: Session, course: Course, title: str, text: str, *, source_type: str,
                    owner_id: Optional[int], filename: Optional[str] = None,
                    mime_type: Optional[str] = None) -> tuple[CourseDocument, bool]:
    """
    Register a document (status PENDING) without embedding it.
    Returns (document, created). Identical content in the same course is not ingested twice.
    """
    text = normalize_text(text)
    digest = _hash(text)
    existing = (
        db.query(CourseDocument)
        .filter(CourseDocument.course_id == course.id, CourseDocument.content_hash == digest)
        .first()
    )
    if existing is not None:
        return existing, False
    doc = CourseDocument(course_id=course.id, owner_id=owner_id, title=title[:300], source_type=source_type,
                         filename=filename, mime_type=mime_type, content_hash=digest, text=text,
                         status=DocumentStatus.PENDING.value)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc, True


def ingest_upload(db: Session, course: Course, filename: str, data: bytes, owner_id: int,
                  mime_type: Optional[str] = None) -> tuple[CourseDocument, bool]:
    """Validate + extract a file, then register it. Raises ExtractionError for unusable files."""
    text = extract_text(filename, data)
    title = re.sub(r"\.[A-Za-z0-9]+$", "", filename or "Document")[:300] or "Document"
    return create_document(db, course, title, text, source_type=DocumentSource.UPLOAD.value,
                           owner_id=owner_id, filename=filename, mime_type=mime_type)


def recover_interrupted_documents() -> int:
    """Mark documents stuck in PROCESSING (the worker died mid-job) as FAILED so they can be re-indexed."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        stuck = db.query(CourseDocument).filter(CourseDocument.status == DocumentStatus.PROCESSING.value).update(
            {"status": DocumentStatus.FAILED.value, "error": "Indexing was interrupted by a server restart. Re-index to retry."},
            synchronize_session=False)
        db.commit()
        return stuck
    finally:
        db.close()


def reset_for_reingest(db: Session, doc: CourseDocument) -> CourseDocument:
    doc.status = DocumentStatus.PENDING.value
    doc.error = None
    db.commit()
    return doc


def delete_document(db: Session, doc: CourseDocument) -> None:
    course_id = doc.course_id
    db.delete(doc)  # chunks cascade
    db.commit()
    index.invalidate(course_id)


# --------------------------------------------------------------------------- course content as a document

def course_content_text(course: Course, modules: Optional[list[Module]] = None) -> str:
    parts = [f"# {course.title}"]
    if course.short_description:
        parts.append(course.short_description)
    if course.description:
        parts.append(course.description)
    if course.learning_objectives:
        parts.append(f"## Learning objectives\n{course.learning_objectives}")
    if course.prerequisites:
        parts.append(f"## Prerequisites\n{course.prerequisites}")
    for number, module in enumerate(modules if modules is not None else course.modules, start=1):
        parts.append(f"## Module {number}: {module.title}")
        if module.description:
            parts.append(module.description)
        for lecture in module.lectures:
            parts.append(f"### {module.title} — {lecture.title}")
            if lecture.description:
                parts.append(lecture.description)
    return normalize_text("\n\n".join(parts))


def sync_course_content(db: Session, course: Course) -> Optional[CourseDocument]:
    """
    Keep one 'course content' document in step with the course/module/lecture records.
    Cheap when nothing changed (hash + model comparison); re-embeds when content or model changed.
    """
    modules = (
        db.query(Module).options(joinedload(Module.lectures)).filter(Module.course_id == course.id)
        .order_by(Module.order_index).all()
    )
    text = course_content_text(course, modules)
    if len(text) < 20:
        return None
    digest = _hash(text)
    doc = (
        db.query(CourseDocument)
        .filter(CourseDocument.course_id == course.id, CourseDocument.source_type == DocumentSource.COURSE_CONTENT.value)
        .first()
    )
    model_name = settings.EMBEDDING_MODEL
    if doc is not None and doc.content_hash == digest and doc.status == DocumentStatus.READY.value \
            and doc.embedding_model == model_name:
        return doc
    if doc is None:
        # An upload with byte-identical text would collide with the unique hash; reuse it instead.
        clash = db.query(CourseDocument).filter(CourseDocument.course_id == course.id,
                                                CourseDocument.content_hash == digest).first()
        if clash is not None:
            return clash
        doc = CourseDocument(course_id=course.id, owner_id=course.instructor_id, title=f"{course.title} — course outline",
                             source_type=DocumentSource.COURSE_CONTENT.value, content_hash=digest, text=text,
                             status=DocumentStatus.PENDING.value)
        db.add(doc)
    else:
        doc.content_hash, doc.text = digest, text
        doc.status = DocumentStatus.PENDING.value
    db.commit()
    return process_document(db, doc.id)


# --------------------------------------------------------------------------- retrieval

_SMALL_TALK_RE = re.compile(
    r"^\s*(hi|hello|hey|thanks|thank you|thx|ok|okay|cool|great|bye|good (morning|evening|night)|who are you)\W*$", re.I)


def needs_retrieval(query: str) -> bool:
    """Skip the vector search for greetings and acknowledgements; everything else is searched."""
    q = (query or "").strip()
    return len(q) >= 3 and not _SMALL_TALK_RE.match(q)


_OVERVIEW_RE = re.compile(
    r"\b(this course|the course|syllabus|curriculum|course (overview|content|outline)|what (will|do|can) i (learn|study)|"
    r"what('s| is| does) (covered|included|taught)|topics (covered|included))\b", re.I)


def is_overview_query(query: str) -> bool:
    """Generic 'what is in this course?' questions match no specific passage; they want the outline."""
    return bool(_OVERVIEW_RE.search(query or ""))


def _outline_chunks(db: Session, course_id: int, limit: int = 3) -> list["index.Hit"]:
    """First chunks of the course's own outline document (title, description, objectives)."""
    doc = (db.query(CourseDocument)
           .filter(CourseDocument.course_id == course_id, CourseDocument.source_type == DocumentSource.COURSE_CONTENT.value,
                   CourseDocument.status == DocumentStatus.READY.value).first())
    if doc is None:
        return []
    rows = (db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_index).limit(limit).all())
    # score 0.0: these are included because the question is a generic overview, not because they matched
    return [index.Hit(chunk_id=r.id, document_id=doc.id, document_title=doc.title, section=r.section, text=r.text, score=0.0)
            for r in rows]


@dataclass
class Source:
    n: int
    document_id: int
    title: str
    section: Optional[str]
    score: float
    text: str = field(repr=False)

    def public(self) -> dict:
        return {"id": self.n, "document_id": self.document_id, "title": self.title,
                "section": self.section, "score": round(self.score, 3)}


@dataclass
class Retrieval:
    sources: list[Source]
    context: str


def retrieve(db: Session, course_id: int, query: str, top_k: Optional[int] = None) -> Retrieval:
    """
    Authorization MUST have been checked by the caller (ai.rag.access.authorize_course_access).
    Only chunks of `course_id` are searched.
    """
    top_k = top_k or settings.RAG_TOP_K
    emb = embedder.get_embedder()
    query_vector = emb.encode([query])[0]
    hits = index.search(db, course_id, query_vector, emb.model_name, emb.dim, top_k * 3)

    selected: list[index.Hit] = []
    seen_text: set[str] = set()
    per_document: dict[int, int] = {}
    budget = settings.RAG_MAX_CONTEXT_CHARS
    for hit in hits:  # already sorted by descending similarity
        if hit.score < settings.RAG_MIN_SCORE:
            break
        key = re.sub(r"\s+", " ", hit.text).strip().lower()
        if key in seen_text or per_document.get(hit.document_id, 0) >= 3:
            continue
        if len(hit.text) > budget and selected:
            continue
        seen_text.add(key)
        per_document[hit.document_id] = per_document.get(hit.document_id, 0) + 1
        budget -= len(hit.text)
        selected.append(hit)
        if len(selected) >= top_k:
            break

    if not selected and is_overview_query(query):
        selected = _outline_chunks(db, course_id)

    sources = [Source(n=i, document_id=h.document_id, title=h.document_title, section=h.section,
                      score=h.score, text=h.text) for i, h in enumerate(selected, start=1)]
    context = "\n\n".join(
        f"[S{s.n}] {s.title}" + (f" — {s.section}" if s.section else "") + f"\n{s.text}" for s in sources)
    return Retrieval(sources=sources, context=context)


_CITATION_RE = re.compile(r"\[(S\d+(?:\s*,\s*S\d+)*)\]")   # [S1] or [S1, S2]
_SOURCE_ID_RE = re.compile(r"S(\d+)")


def resolve_citations(answer: str, sources: list[Source]) -> tuple[str, list[dict]]:
    """
    Drop citations that point at sources the model was never given, and report which real
    sources it cited. Source metadata comes from retrieval, never from the model's text.
    """
    valid = {s.n for s in sources}
    cited: set[int] = set()

    def _keep(match: re.Match) -> str:
        ids = [int(n) for n in _SOURCE_ID_RE.findall(match.group(1))]
        real = [n for n in ids if n in valid]
        cited.update(real)
        return f"[{', '.join(f'S{n}' for n in real)}]" if real else ""

    cleaned = _CITATION_RE.sub(_keep, answer)
    public = []
    for s in sources:
        item = s.public()
        item["cited"] = s.n in cited
        public.append(item)
    return cleaned, public
