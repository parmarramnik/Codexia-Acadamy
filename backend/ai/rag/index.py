"""
Per-course FAISS indexes derived from the chunk rows in the database.

Why per course and DB-derived:
  * Retrieval can only ever see the one course the caller was authorised for — there is no
    global index to filter after the fact.
  * Chunk metadata and vectors live in the persistent database, so an index is just a cache:
    missing, stale or half-written indexes are rebuilt from the rows, and nothing depends on
    Render's ephemeral disk.
The cache holds vectors only; authorization is checked on every request before it is touched.
"""

import logging
import threading
from dataclasses import dataclass
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from models.rag import CourseDocument, DocumentChunk, DocumentStatus

logger = logging.getLogger("codexia.rag.index")


class IndexUnavailable(Exception):
    """faiss-cpu is not installed or the stored vectors are unusable."""


@dataclass
class Hit:
    chunk_id: int
    document_id: int
    document_title: str
    section: Optional[str]
    text: str
    score: float


@dataclass
class _CourseIndex:
    fingerprint: tuple
    index: object
    meta: list[tuple[int, int, str, Optional[str], str]]  # chunk_id, document_id, doc title, section, text


_cache: dict[int, _CourseIndex] = {}
_lock = threading.Lock()


def _faiss():
    try:
        import faiss
        return faiss
    except ImportError as exc:
        raise IndexUnavailable("faiss-cpu is not installed on this server (see backend/requirements.txt).") from exc


def _ready_documents(db: Session, course_id: int, model_name: str) -> list[CourseDocument]:
    return (
        db.query(CourseDocument)
        .filter(CourseDocument.course_id == course_id, CourseDocument.status == DocumentStatus.READY.value,
                CourseDocument.embedding_model == model_name)
        .order_by(CourseDocument.id)
        .all()
    )


def fingerprint(docs: list[CourseDocument], model_name: str, dim: int) -> tuple:
    return (model_name, dim, tuple((d.id, d.updated_at.isoformat() if d.updated_at else None, d.chunk_count)
                                   for d in docs))


def invalidate(course_id: int) -> None:
    with _lock:
        _cache.pop(course_id, None)


def clear() -> None:
    with _lock:
        _cache.clear()


def _build(db: Session, course_id: int, docs: list[CourseDocument], dim: int, fp: tuple) -> _CourseIndex:
    faiss = _faiss()
    titles = {d.id: d.title for d in docs}
    rows = (
        db.query(DocumentChunk.id, DocumentChunk.document_id, DocumentChunk.section, DocumentChunk.text,
                 DocumentChunk.embedding)
        .filter(DocumentChunk.course_id == course_id, DocumentChunk.document_id.in_(titles.keys()))
        .order_by(DocumentChunk.id)
        .all()
    )
    index = faiss.IndexFlatIP(dim)  # inner product on normalised vectors == cosine similarity
    meta = []
    vectors = []
    for chunk_id, document_id, section, text, blob in rows:
        vector = np.frombuffer(blob, dtype=np.float32)
        if vector.shape[0] != dim:
            logger.error("Chunk %s has dimension %s, expected %s; skipping", chunk_id, vector.shape[0], dim)
            continue
        vectors.append(vector)
        meta.append((chunk_id, document_id, titles[document_id], section, text))
    if vectors:
        index.add(np.ascontiguousarray(np.vstack(vectors), dtype=np.float32))
    return _CourseIndex(fingerprint=fp, index=index, meta=meta)


def search(db: Session, course_id: int, query_vector: np.ndarray, model_name: str, dim: int, k: int) -> list[Hit]:
    """Nearest chunks of ONE course. The returned scores are cosine similarities."""
    docs = _ready_documents(db, course_id, model_name)
    if not docs:
        return []
    fp = fingerprint(docs, model_name, dim)
    entry = _cache.get(course_id)
    if entry is None or entry.fingerprint != fp:
        with _lock:
            entry = _cache.get(course_id)
            if entry is None or entry.fingerprint != fp:
                entry = _build(db, course_id, docs, dim, fp)
                _cache[course_id] = entry
    if entry.index.ntotal == 0:
        return []
    query = np.ascontiguousarray(query_vector.reshape(1, -1), dtype=np.float32)
    if query.shape[1] != dim:
        raise IndexUnavailable("Query and document embeddings have different dimensions.")
    scores, positions = entry.index.search(query, min(k, entry.index.ntotal))
    hits = []
    for score, position in zip(scores[0], positions[0]):
        if position < 0:
            continue
        chunk_id, document_id, title, section, text = entry.meta[position]
        hits.append(Hit(chunk_id=chunk_id, document_id=document_id, document_title=title,
                        section=section, text=text, score=float(score)))
    return hits
