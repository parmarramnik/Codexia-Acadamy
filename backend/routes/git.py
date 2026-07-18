"""
Git Version Control routes for notes.
"""

import io
import json
import difflib
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.content import Note
from models.git import GitBranch, GitCommit, GitTag
from schemas.git import (
    CommitRequest, CommitResponse, BranchRequest, BranchResponse,
    CheckoutRequest, CheckoutResponse, MergeRequest, MergeResponse,
    CherryPickRequest, CherryPickResponse, TagRequest, TagResponse,
    RestoreRequest, DiffHunkResponse, CompareResponse, TimelineResponse,
    AICommitSummaryResponse
)
from schemas.analytics import NoteResponse
import services.git_service as git_service
from ai.generator import generate_commit_message

router = APIRouter()


def _get_user_note(db: Session, note_id: int, user_id: int) -> Note:
    """Helper to fetch a note and verify it belongs to the authenticated user."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.post("/commit", response_model=CommitResponse)
def create_manual_commit(
    data: CommitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually create a commit of the note's current state."""
    note = _get_user_note(db, data.note_id, current_user.id)
    commit = git_service.create_commit(
        db=db,
        note=note,
        message=data.message,
        user_id=current_user.id,
        is_checkpoint=data.is_checkpoint,
        metadata=data.metadata
    )
    return commit


@router.post("/branch", response_model=BranchResponse)
def create_branch(
    data: BranchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new branch branching off from the active HEAD commit."""
    note = _get_user_note(db, data.note_id, current_user.id)
    branch = git_service.create_branch(db, note, data.name, current_user.id)
    return branch


@router.post("/checkout", response_model=CheckoutResponse)
def checkout_branch(
    data: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Switch active branch. Restores working copy to branch's HEAD commit."""
    note = _get_user_note(db, data.note_id, current_user.id)
    result = git_service.checkout_branch(db, note, data.branch_id, data.force)
    return result


@router.post("/merge", response_model=MergeResponse)
def merge_branches(
    data: MergeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Merge source_branch into target_branch.
    Handles fast-forward or conflict states.
    If conflict occurs, user must send a strategy ("keep_target", "keep_source", "merge_both", "custom").
    """
    note = _get_user_note(db, data.note_id, current_user.id)
    result = git_service.merge_branches(
        db=db,
        note=note,
        source_branch_id=data.source_branch_id,
        target_branch_id=data.target_branch_id,
        user_id=current_user.id,
        resolve_strategy=data.resolve_strategy,
        custom_content=data.custom_content,
        custom_title=data.custom_title
    )
    return result


@router.post("/cherry-pick", response_model=CherryPickResponse)
def cherry_pick_commit(
    data: CherryPickRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply changes from a single commit onto the current branch."""
    note = _get_user_note(db, data.note_id, current_user.id)
    new_commit, has_conflict = git_service.cherry_pick_commit_action(db, note, data.commit_id, current_user.id)
    
    if has_conflict:
        return {
            "status": "conflict",
            "has_conflicts": True,
            "commit_id": new_commit.id,
            "message": "Cherry-pick conflict occurred. Conflict markers inserted in document."
        }
    return {
        "status": "success",
        "has_conflicts": False,
        "commit_id": new_commit.id,
        "message": "Cherry-pick successful."
    }


@router.get("/history", response_model=List[CommitResponse])
def get_commit_history(
    note_id: int,
    query: Optional[str] = None,
    author: Optional[str] = None,
    branch_id: Optional[int] = None,
    tag: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get commit history with filters for message, author, branch, and tag."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)
    return git_service.get_commit_history(db, note.id, query, author, branch_id, tag)


@router.get("/branches", response_model=List[BranchResponse])
def get_branches(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all branches created for a note."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)
    return db.query(GitBranch).filter(GitBranch.note_id == note.id).all()


@router.get("/diff", response_model=List[DiffHunkResponse])
def get_diff(
    note_id: int,
    commit_b: str,
    commit_a: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Compare two commits or compare working copy against commit B."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)
    diff = git_service.get_diff(db, note, commit_a, commit_b)
    return diff


@router.get("/compare", response_model=CompareResponse)
def compare_branches(
    note_id: int,
    branch_a_id: int,
    branch_b_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Compare two branches and return details on fast-forward possibility, conflicts, and full diff."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)
    
    branch_a = db.query(GitBranch).filter(GitBranch.id == branch_a_id, GitBranch.note_id == note.id).first()
    branch_b = db.query(GitBranch).filter(GitBranch.id == branch_b_id, GitBranch.note_id == note.id).first()
    if not branch_a or not branch_b:
        raise HTTPException(status_code=404, detail="Branch not found.")

    if not branch_a.head_commit_id or not branch_b.head_commit_id:
        raise HTTPException(status_code=400, detail="Branch has no commits.")

    ancestor_id = git_service.find_common_ancestor(db, branch_a.head_commit_id, branch_b.head_commit_id)
    can_ff = ancestor_id == branch_a.head_commit_id

    # Load contents for comparison
    commit_a = db.query(GitCommit).filter(GitCommit.id == branch_a.head_commit_id).first()
    commit_b = db.query(GitCommit).filter(GitCommit.id == branch_b.head_commit_id).first()
    
    snap_a = json.loads(commit_a.snapshot)
    snap_b = json.loads(commit_b.snapshot)
    
    # Check for conflicts
    has_conflicts = False
    if snap_a.get("content") != snap_b.get("content") and ancestor_id:
        # If both modified since split
        has_conflicts = True

    diff = git_service.compute_side_by_side_diff(snap_a.get("content", ""), snap_b.get("content", ""))

    return {
        "can_fast_forward": can_ff,
        "has_conflicts": has_conflicts,
        "common_ancestor_commit": ancestor_id,
        "diff": diff
    }


@router.get("/timeline", response_model=TimelineResponse)
def get_timeline(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full git timeline commits layout configured with SVG rendering coordinates."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)
    timeline = git_service.compute_timeline_graph(db, note.id)
    return {
        "commits": timeline,
        "active_branch_id": note.current_branch_id
    }


@router.post("/tag", response_model=TagResponse)
def tag_commit(
    data: TagRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tag a commit with a human-readable name (pin)."""
    note = _get_user_note(db, data.note_id, current_user.id)
    tag = git_service.create_tag(db, note, data.commit_id, data.name)
    return tag


@router.post("/restore", response_model=NoteResponse)
def restore_commit(
    data: RestoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revert the note's state back to a previous commit's snapshot (creates a new commit)."""
    note = _get_user_note(db, data.note_id, current_user.id)
    restored = git_service.restore_commit(db, note, data.commit_id, current_user.id)
    return restored


@router.post("/commit/{commit_id}/favorite", response_model=CommitResponse)
def favorite_commit(
    commit_id: str,
    is_favorite: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Star or unstar a commit."""
    commit = db.query(GitCommit).filter(GitCommit.id == commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")
    _get_user_note(db, commit.note_id, current_user.id) # Scoping check
    updated = git_service.toggle_favorite(db, commit_id, is_favorite)
    return updated


@router.get("/ai-summary", response_model=AICommitSummaryResponse)
def get_ai_commit_summary(
    note_id: int,
    commit_b: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask Gemini to generate a commit summary message based on the diff of current changes."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)

    # Calculate unified diff
    head_content = ""
    if commit_b:
        commit = db.query(GitCommit).filter(GitCommit.id == commit_b, GitCommit.note_id == note.id).first()
        if commit:
            snap = json.loads(commit.snapshot)
            head_content = snap.get("content", "")
    else:
        branch = db.query(GitBranch).filter(GitBranch.id == note.current_branch_id).first()
        if branch and branch.head_commit_id:
            head_commit = db.query(GitCommit).filter(GitCommit.id == branch.head_commit_id).first()
            if head_commit:
                snap = json.loads(head_commit.snapshot)
                head_content = snap.get("content", "")

    diff_lines = list(difflib.unified_diff(
        head_content.splitlines(),
        note.content.splitlines(),
        fromfile='HEAD',
        tofile='Working Copy',
        lineterm=''
    ))
    
    if not diff_lines:
        return {"summary": "No changes detected."}

    diff_text = "\n".join(diff_lines[:150]) # Cap diff to avoid token overflow
    summary = generate_commit_message(diff_text)
    return {"summary": summary}


@router.get("/export")
def export_git_history(
    note_id: int,
    format: str = Query(..., pattern="^(json|markdown|pdf)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export note and commit history to JSON, Markdown, or PDF format."""
    note = _get_user_note(db, note_id, current_user.id)
    git_service.ensure_git_init(db, note, current_user.id)

    commits = db.query(GitCommit).filter(GitCommit.note_id == note.id).order_by(GitCommit.created_at.desc()).all()
    branches = db.query(GitBranch).filter(GitBranch.note_id == note.id).all()

    if format == "json":
        data = {
            "note": {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "created_at": note.created_at.isoformat()
            },
            "branches": [
                {
                    "id": b.id,
                    "name": b.name,
                    "head_commit_id": b.head_commit_id,
                    "created_at": b.created_at.isoformat()
                }
                for b in branches
            ],
            "commits": [
                {
                    "id": c.id,
                    "message": c.message,
                    "parent_commit": c.parent_commit,
                    "created_at": c.created_at.isoformat(),
                    "author": c.author.username if c.author else "System",
                    "is_favorite": c.is_favorite,
                    "is_checkpoint": c.is_checkpoint,
                    "metadata": json.loads(c.metadata_json) if c.metadata_json else {}
                }
                for c in commits
            ]
        }
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=note_{note.id}_history.json"}
        )

    elif format == "markdown":
        md = []
        md.append(f"# Note History: {note.title}\n")
        md.append(f"Exported on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        md.append("## Current Note Content\n")
        md.append("```markdown")
        md.append(note.content)
        md.append("```\n")
        
        md.append("## Commit Timeline Log\n")
        for c in commits:
            tags = [t.name for t in c.commit_tags]
            tag_str = f" [Tags: {', '.join(tags)}]" if tags else ""
            fav_str = " ★" if c.is_favorite else ""
            checkpoint_str = " [Checkpoint]" if c.is_checkpoint else ""
            md.append(f"### Commit {c.id[:8]}{fav_str}{checkpoint_str}")
            md.append(f"- **Message**: {c.message}")
            md.append(f"- **Author**: {c.author.username if c.author else 'System'}")
            md.append(f"- **Date**: {c.created_at.strftime('%Y-%m-%d %H:%M:%S')}{tag_str}")
            md.append("")

        return Response(
            content="\n".join(md),
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=note_{note.id}_history.md"}
        )

    elif format == "pdf":
        pdf_bytes = git_service.generate_note_history_pdf(note.title, commits, branches)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=note_{note.id}_history.pdf"}
        )
