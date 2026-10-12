"""
RAG storage: documents and their embedded chunks.

The database is the persistent source of truth. FAISS indexes are derived from these rows
(per course), so they can always be rebuilt and can never disagree with the metadata.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, LargeBinary, Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentSource(str, enum.Enum):
    COURSE_CONTENT = "course_content"  # generated from the course/module/lecture records
    UPLOAD = "upload"                  # instructor-uploaded PDF/DOCX/TXT/MD


class CourseDocument(Base):
    __tablename__ = "course_documents"
    __table_args__ = (
        # The same content can only be ingested once per course (duplicate-upload protection).
        UniqueConstraint("course_id", "content_hash", name="uq_course_documents_course_hash"),
        Index("ix_course_documents_course_status", "course_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(300), nullable=False)
    source_type = Column(String(20), nullable=False, default=DocumentSource.UPLOAD.value)
    filename = Column(String(255), nullable=True)
    mime_type = Column(String(100), nullable=True)
    # Only learners with verified access to the course may retrieve this document.
    visibility = Column(String(20), nullable=False, default="enrolled", server_default="enrolled")
    content_hash = Column(String(64), nullable=False)
    text = Column(Text, nullable=True)  # extracted text, kept so a document can be re-ingested without the file
    status = Column(String(12), nullable=False, default=DocumentStatus.PENDING.value, index=True)
    error = Column(String(500), nullable=True)
    chunk_count = Column(Integer, nullable=False, default=0)
    embedding_model = Column(String(200), nullable=True)
    embedding_dim = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_doc_index"),
        Index("ix_document_chunks_course", "course_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("course_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    # Denormalised so retrieval filters by course without a join.
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    section = Column(String(300), nullable=True)
    text = Column(Text, nullable=False)
    embedding = Column(LargeBinary, nullable=False)  # float32, L2-normalised
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    document = relationship("CourseDocument", back_populates="chunks")
