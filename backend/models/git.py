"""
Database models for Git Version Control of Notes.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class GitBranch(Base):
    __tablename__ = "git_branches"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    head_commit_id = Column(String(36), ForeignKey("git_commits.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    note = relationship("Note", backref="branches", foreign_keys=[note_id])
    creator = relationship("User", backref="created_branches")
    head_commit = relationship("GitCommit", foreign_keys=[head_commit_id], post_update=True)

    def __repr__(self):
        return f"<GitBranch(id={self.id}, name='{self.name}', note_id={self.note_id})>"


class GitCommit(Base):
    __tablename__ = "git_commits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(Integer, ForeignKey("git_branches.id", ondelete="SET NULL"), nullable=True)
    parent_commit = Column(String(36), ForeignKey("git_commits.id", ondelete="SET NULL"), nullable=True)
    message = Column(String(300), nullable=False)
    snapshot = Column(Text, nullable=False)  # JSON-encoded dictionary {"title": ..., "content": ...}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    metadata_json = Column(Text, nullable=True)  # JSON-encoded dictionary

    is_favorite = Column(Boolean, default=False, nullable=False)
    is_checkpoint = Column(Boolean, default=False, nullable=False)

    # Relationships
    note = relationship("Note", backref="commits", foreign_keys=[note_id])
    author = relationship("User", backref="commits")
    branch = relationship("GitBranch", foreign_keys=[branch_id])

    def __repr__(self):
        return f"<GitCommit(id='{self.id[:8]}', message='{self.message[:30]}', note_id={self.note_id})>"


class GitTag(Base):
    __tablename__ = "git_tags"

    id = Column(Integer, primary_key=True, index=True)
    commit_id = Column(String(36), ForeignKey("git_commits.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    commit = relationship("GitCommit", backref="commit_tags")

    def __repr__(self):
        return f"<GitTag(id={self.id}, name='{self.name}', commit_id='{self.commit_id[:8]}')>"


class GitMergeHistory(Base):
    __tablename__ = "git_merge_history"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    source_branch = Column(String(100), nullable=False)
    target_branch = Column(String(100), nullable=False)
    merged_commit = Column(String(36), ForeignKey("git_commits.id", ondelete="CASCADE"), nullable=False)
    merged_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    note = relationship("Note", backref="merges")
    commit = relationship("GitCommit")

    def __repr__(self):
        return f"<GitMergeHistory(id={self.id}, source='{self.source_branch}', target='{self.target_branch}')>"
