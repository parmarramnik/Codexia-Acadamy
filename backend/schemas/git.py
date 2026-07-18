"""
Pydantic schemas for Git Version Control of Notes.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# --- Commits ---

class CommitRequest(BaseModel):
    note_id: int
    message: str = Field(..., min_length=1, max_length=300)
    is_checkpoint: bool = False
    metadata: Optional[Dict[str, Any]] = None


class CommitResponse(BaseModel):
    id: str
    note_id: int
    branch_id: Optional[int]
    parent_commit: Optional[str]
    message: str
    snapshot: str
    created_at: datetime
    author_id: int
    metadata_json: Optional[str]
    is_favorite: bool
    is_checkpoint: bool

    class Config:
        from_attributes = True


# --- Branches ---

class BranchRequest(BaseModel):
    note_id: int
    name: str = Field(..., min_length=1, max_length=100)


class BranchResponse(BaseModel):
    id: int
    note_id: int
    name: str
    head_commit_id: Optional[str]
    created_at: datetime
    created_by: int

    class Config:
        from_attributes = True


# --- Checkout ---

class CheckoutRequest(BaseModel):
    note_id: int
    branch_id: int
    force: bool = False


class CheckoutResponse(BaseModel):
    success: bool
    unsaved_changes: bool = False
    message: str
    note_id: Optional[int] = None
    current_branch_id: Optional[int] = None


# --- Merges ---

class MergeRequest(BaseModel):
    note_id: int
    source_branch_id: int
    target_branch_id: int
    resolve_strategy: Optional[str] = None  # "keep_target", "keep_source", "merge_both", "custom"
    custom_content: Optional[str] = None
    custom_title: Optional[str] = None


class MergeResponse(BaseModel):
    status: str  # "success", "fast-forward", "conflict"
    conflict_content: Optional[str] = None
    target_content: Optional[str] = None
    source_content: Optional[str] = None
    ancestor_content: Optional[str] = None
    merged_commit_id: Optional[str] = None
    message: str


# --- Cherry-pick ---

class CherryPickRequest(BaseModel):
    note_id: int
    commit_id: str


class CherryPickResponse(BaseModel):
    status: str  # "success", "conflict"
    has_conflicts: bool
    commit_id: Optional[str] = None
    message: str


# --- Tags ---

class TagRequest(BaseModel):
    note_id: int
    commit_id: str
    name: str = Field(..., min_length=1, max_length=100)


class TagResponse(BaseModel):
    id: int
    commit_id: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Restore ---

class RestoreRequest(BaseModel):
    note_id: int
    commit_id: str


# --- Diff & Compare ---

class DiffHunkResponse(BaseModel):
    type: str  # "equal", "added", "deleted", "modified"
    left: Optional[str] = None
    right: Optional[str] = None


class CompareResponse(BaseModel):
    can_fast_forward: bool
    has_conflicts: bool
    common_ancestor_commit: Optional[str] = None
    diff: List[DiffHunkResponse]


# --- Timeline ---

class TimelineCommitResponse(BaseModel):
    id: str
    message: str
    parent_commit: Optional[str]
    created_at: str
    author: str
    branch_id: Optional[int]
    branch_name: str
    track: int
    tags: List[str]
    is_favorite: bool
    is_checkpoint: bool
    metadata: Dict[str, Any]


class TimelineResponse(BaseModel):
    commits: List[TimelineCommitResponse]
    active_branch_id: Optional[int] = None


# --- AI Summary ---

class AICommitSummaryResponse(BaseModel):
    summary: str
