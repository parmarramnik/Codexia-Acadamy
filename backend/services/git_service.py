"""
Git Version Control service for Notes.
Enforces git branching, commit creation, merge history, cherry-pick, tag, restore, and diff logic.
"""

import json
import uuid
import io
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect

from models.content import Note
from models.git import GitBranch, GitCommit, GitTag, GitMergeHistory
from models.user import User


def ensure_git_init(db: Session, note: Note, user_id: int) -> Tuple[GitBranch, GitCommit]:
    """
    Ensures that a Note has a git repository initialized with a 'main' branch
    and an initial commit of its current state.
    """
    # 1. Find or create the default 'main' branch
    main_branch = db.query(GitBranch).filter(
        GitBranch.note_id == note.id,
        GitBranch.name == "main"
    ).first()

    if not main_branch:
        main_branch = GitBranch(
            note_id=note.id,
            name="main",
            created_by=user_id
        )
        db.add(main_branch)
        db.flush()

    # 2. Check if there are any commits
    first_commit = db.query(GitCommit).filter(
        GitCommit.note_id == note.id
    ).first()

    if not first_commit:
        snapshot = json.dumps({"title": note.title, "content": note.content})
        metadata = {
            "word_count": len(note.content.split()),
            "char_count": len(note.content),
            "reading_time": max(1, len(note.content.split()) // 200),
            "is_ai_generated": note.is_ai_generated,
            "manual": True,
            "device": "Web Browser",
            "editor_version": "1.0"
        }
        
        first_commit = GitCommit(
            note_id=note.id,
            branch_id=main_branch.id,
            parent_commit=None,
            message="Initial commit",
            snapshot=snapshot,
            author_id=user_id,
            is_checkpoint=True,
            metadata_json=json.dumps(metadata)
        )
        db.add(first_commit)
        db.flush()

    # 3. Point branch head and note active branch to correct places
    if not main_branch.head_commit_id:
        main_branch.head_commit_id = first_commit.id

    if not note.current_branch_id:
        note.current_branch_id = main_branch.id
        db.commit()

    return main_branch, first_commit


def create_commit(
    db: Session,
    note: Note,
    message: str,
    user_id: int,
    is_checkpoint: bool = False,
    metadata: Optional[Dict[str, Any]] = None
) -> GitCommit:
    """
    Creates a new commit on the note's active branch with the current note snapshot.
    """
    branch, _ = ensure_git_init(db, note, user_id)
    
    # Retrieve current active branch (could be different from main)
    active_branch = db.query(GitBranch).filter(GitBranch.id == note.current_branch_id).first()
    if not active_branch:
        active_branch = branch

    snapshot = json.dumps({"title": note.title, "content": note.content})
    
    # Calculate word and char count
    words = note.content.split()
    word_count = len(words)
    char_count = len(note.content)
    reading_time = max(1, word_count // 200) # Assumes 200 words per minute average

    commit_metadata = {
        "word_count": word_count,
        "char_count": char_count,
        "reading_time": reading_time,
        "is_ai_generated": note.is_ai_generated,
        "manual": metadata.get("manual", True) if metadata else True,
        "device": metadata.get("device", "Web Browser") if metadata else "Web Browser",
        "editor_version": metadata.get("editor_version", "1.0") if metadata else "1.0"
    }

    commit = GitCommit(
        note_id=note.id,
        branch_id=active_branch.id,
        parent_commit=active_branch.head_commit_id,
        message=message,
        snapshot=snapshot,
        author_id=user_id,
        is_favorite=False,
        is_checkpoint=is_checkpoint,
        metadata_json=json.dumps(commit_metadata)
    )
    db.add(commit)
    db.flush()

    # Update active branch HEAD
    active_branch.head_commit_id = commit.id
    db.commit()
    db.refresh(commit)
    return commit


def create_branch(db: Session, note: Note, name: str, user_id: int) -> GitBranch:
    """
    Creates a new branch branching off from the current HEAD commit.
    """
    ensure_git_init(db, note, user_id)
    
    # Check if branch name already exists for this note
    existing = db.query(GitBranch).filter(
        GitBranch.note_id == note.id,
        GitBranch.name == name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Branch '{name}' already exists.")

    active_branch = db.query(GitBranch).filter(GitBranch.id == note.current_branch_id).first()
    head_commit_id = active_branch.head_commit_id if active_branch else None

    new_branch = GitBranch(
        note_id=note.id,
        name=name,
        head_commit_id=head_commit_id,
        created_by=user_id
    )
    db.add(new_branch)
    db.commit()
    db.refresh(new_branch)
    return new_branch


def checkout_branch(db: Session, note: Note, branch_id: int, force: bool = False) -> Dict[str, Any]:
    """
    Switches active branch. Warns if working copy has unsaved changes unless force=True.
    """
    branch = db.query(GitBranch).filter(
        GitBranch.id == branch_id,
        GitBranch.note_id == note.id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found.")

    ensure_git_init(db, note, branch.created_by)

    # Check for uncommitted changes in current branch
    current_branch = db.query(GitBranch).filter(GitBranch.id == note.current_branch_id).first()
    if current_branch and current_branch.head_commit_id:
        head_commit = db.query(GitCommit).filter(GitCommit.id == current_branch.head_commit_id).first()
        if head_commit:
            snap = json.loads(head_commit.snapshot)
            head_title = snap.get("title", "")
            head_content = snap.get("content", "")
            
            has_unsaved = (note.title != head_title) or (note.content != head_content)
            if has_unsaved and not force:
                return {
                    "success": False,
                    "unsaved_changes": True,
                    "message": "Uncommitted changes exist. Use force=true to checkout and discard changes."
                }

    # Restore target branch HEAD to working copy
    if branch.head_commit_id:
        target_head = db.query(GitCommit).filter(GitCommit.id == branch.head_commit_id).first()
        if target_head:
            snap = json.loads(target_head.snapshot)
            note.title = snap.get("title", "")
            note.content = snap.get("content", "")

    note.current_branch_id = branch.id
    db.commit()
    
    return {
        "success": True,
        "unsaved_changes": False,
        "message": f"Checked out branch '{branch.name}'.",
        "note_id": note.id,
        "current_branch_id": branch.id
    }


def get_commit_history_ids(db: Session, start_commit_id: Optional[str]) -> List[str]:
    """Helper to return path from commit to root (following parent_commit)."""
    path = []
    current = start_commit_id
    visited = set()
    while current and current not in visited:
        path.append(current)
        visited.add(current)
        commit = db.query(GitCommit.parent_commit).filter(GitCommit.id == current).first()
        if not commit:
            break
        current = commit.parent_commit
    return path


def find_common_ancestor(db: Session, commit_a_id: str, commit_b_id: str) -> Optional[str]:
    """Finds the lowest common ancestor commit of two commits."""
    path_a = get_commit_history_ids(db, commit_a_id)
    set_b = set(get_commit_history_ids(db, commit_b_id))
    for c_id in path_a:
        if c_id in set_b:
            return c_id
    return None


def three_way_merge(ancestor: str, target: str, source: str, target_name: str, source_name: str) -> Tuple[str, bool]:
    """
    Line-by-line three-way merge. If changes are on separate lines, they merge cleanly.
    If they overlap on the same lines, conflict markers are created for that section.
    """
    if target == ancestor:
        return source, False
    if source == ancestor:
        return target, False
    if target == source:
        return target, False

    import difflib
    a_lines = ancestor.splitlines()
    t_lines = target.splitlines()
    s_lines = source.splitlines()

    # Align target and source lines with ancestor lines using SequenceMatcher
    sm_t = difflib.SequenceMatcher(None, a_lines, t_lines)
    sm_s = difflib.SequenceMatcher(None, a_lines, s_lines)

    opcodes_t = sm_t.get_opcodes()
    opcodes_s = sm_s.get_opcodes()

    # Map each ancestor line index to its replacement in target and source
    t_map = {}
    for tag, i1, i2, j1, j2 in opcodes_t:
        if tag == 'equal':
            for i in range(i1, i2):
                t_map[float(i)] = ('equal', [a_lines[i]])
        elif tag == 'delete':
            for i in range(i1, i2):
                t_map[float(i)] = ('delete', [])
        elif tag == 'replace':
            t_map[float(i1)] = ('replace', t_lines[j1:j2])
            for i in range(i1 + 1, i2):
                t_map[float(i)] = ('delete', [])
        elif tag == 'insert':
            t_map[i1 - 0.5] = ('insert', t_lines[j1:j2])

    s_map = {}
    for tag, i1, i2, j1, j2 in opcodes_s:
        if tag == 'equal':
            for i in range(i1, i2):
                s_map[float(i)] = ('equal', [a_lines[i]])
        elif tag == 'delete':
            for i in range(i1, i2):
                s_map[float(i)] = ('delete', [])
        elif tag == 'replace':
            s_map[float(i1)] = ('replace', s_lines[j1:j2])
            for i in range(i1 + 1, i2):
                s_map[float(i)] = ('delete', [])
        elif tag == 'insert':
            s_map[i1 - 0.5] = ('insert', s_lines[j1:j2])

    # Iterate through all possible indices in sorted order
    indices = sorted(list(set(list(t_map.keys()) + list(s_map.keys()))))
    
    merged_lines = []
    has_conflict = False

    for idx in indices:
        t_tag, t_val = t_map.get(idx, ('equal', []))
        s_tag, s_val = s_map.get(idx, ('equal', []))

        # Both are unchanged
        if t_tag == 'equal' and s_tag == 'equal':
            merged_lines.extend(t_val)
        # Target changed, source is unchanged
        elif t_tag != 'equal' and s_tag == 'equal':
            merged_lines.extend(t_val)
        # Source changed, target is unchanged
        elif s_tag != 'equal' and t_tag == 'equal':
            merged_lines.extend(s_val)
        # Both changed
        else:
            if t_val == s_val:
                merged_lines.extend(t_val)
            else:
                has_conflict = True
                conflict_header = f"<<<<<<<< {target_name.upper()}"
                conflict_divider = "========"
                conflict_footer = f">>>>>>>> {source_name.upper()}"
                
                merged_lines.append(conflict_header)
                merged_lines.extend(t_val)
                merged_lines.append(conflict_divider)
                merged_lines.extend(s_val)
                merged_lines.append(conflict_footer)

    return "\n".join(merged_lines), has_conflict


def merge_branches(
    db: Session,
    note: Note,
    source_branch_id: int,
    target_branch_id: int,
    user_id: int,
    resolve_strategy: Optional[str] = None,
    custom_content: Optional[str] = None,
    custom_title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Merges source_branch into target_branch.
    If fast-forward is possible, automatically updates target branch.
    If conflicts exist and no strategy is provided, returns conflict state details.
    """
    source_branch = db.query(GitBranch).filter(GitBranch.id == source_branch_id).first()
    target_branch = db.query(GitBranch).filter(GitBranch.id == target_branch_id).first()

    if not source_branch or not target_branch:
        raise HTTPException(status_code=404, detail="Branch not found.")

    if source_branch.head_commit_id == target_branch.head_commit_id:
        return {"status": "fast-forward", "message": "Already up to date.", "merged_commit_id": target_branch.head_commit_id}

    ancestor_id = find_common_ancestor(db, target_branch.head_commit_id, source_branch.head_commit_id)

    # 1. Fast-Forward Merge: Target HEAD is common ancestor (source is direct descendant)
    if ancestor_id == target_branch.head_commit_id:
        target_branch.head_commit_id = source_branch.head_commit_id
        
        # If active note branch is target, restore working copy
        if note.current_branch_id == target_branch.id:
            head_commit = db.query(GitCommit).filter(GitCommit.id == source_branch.head_commit_id).first()
            if head_commit:
                snap = json.loads(head_commit.snapshot)
                note.title = snap.get("title", "")
                note.content = snap.get("content", "")

        # Record merge history
        merge_log = GitMergeHistory(
            note_id=note.id,
            source_branch=source_branch.name,
            target_branch=target_branch.name,
            merged_commit=source_branch.head_commit_id
        )
        db.add(merge_log)
        db.commit()
        return {"status": "fast-forward", "message": "Fast-forward merge successful.", "merged_commit_id": source_branch.head_commit_id}

    # 2. Three-Way Merge
    # Load commit snapshots
    ancestor_title, ancestor_content = "", ""
    if ancestor_id:
        ancestor_commit = db.query(GitCommit).filter(GitCommit.id == ancestor_id).first()
        if ancestor_commit:
            snap = json.loads(ancestor_commit.snapshot)
            ancestor_title = snap.get("title", "")
            ancestor_content = snap.get("content", "")

    target_commit = db.query(GitCommit).filter(GitCommit.id == target_branch.head_commit_id).first()
    target_snap = json.loads(target_commit.snapshot) if target_commit else {"title": "", "content": ""}
    target_title = target_snap.get("title", "")
    target_content = target_snap.get("content", "")

    source_commit = db.query(GitCommit).filter(GitCommit.id == source_branch.head_commit_id).first()
    source_snap = json.loads(source_commit.snapshot) if source_commit else {"title": "", "content": ""}
    source_title = source_snap.get("title", "")
    source_content = source_snap.get("content", "")

    # Perform Merge
    merged_title, title_conflict = three_way_merge(ancestor_title, target_title, source_title, target_branch.name, source_branch.name)
    merged_content, content_conflict = three_way_merge(ancestor_content, target_content, source_content, target_branch.name, source_branch.name)

    has_conflict = title_conflict or content_conflict

    # If conflicts exist and no strategy is provided, return conflict block details
    if has_conflict and not resolve_strategy:
        return {
            "status": "conflict",
            "message": "Merge conflict detected.",
            "conflict_content": merged_content,
            "target_content": target_content,
            "source_content": source_content,
            "ancestor_content": ancestor_content
        }

    # Strategy application
    if resolve_strategy:
        if resolve_strategy == "keep_target":
            final_title, final_content = target_title, target_content
        elif resolve_strategy == "keep_source":
            final_title, final_content = source_title, source_content
        elif resolve_strategy == "merge_both":
            final_title = target_title if len(target_title) > len(source_title) else source_title
            final_content = f"{target_content}\n\n{source_content}"
        elif resolve_strategy == "custom":
            if not custom_content or not custom_title:
                raise HTTPException(status_code=400, detail="Custom content and title are required for custom strategy.")
            final_title, final_content = custom_title, custom_content
        else:
            raise HTTPException(status_code=400, detail="Invalid strategy.")
    else:
        final_title, final_content = merged_title, merged_content

    # Commit the merge result
    merge_snapshot = json.dumps({"title": final_title, "content": final_content})
    merge_commit = GitCommit(
        note_id=note.id,
        branch_id=target_branch.id,
        parent_commit=target_branch.head_commit_id,
        message=f"Merge branch '{source_branch.name}' into '{target_branch.name}'",
        snapshot=merge_snapshot,
        author_id=user_id,
        is_checkpoint=True,
        metadata_json=json.dumps({"merge_parent_2": source_branch.head_commit_id})
    )
    db.add(merge_commit)
    db.flush()

    # Update HEAD of target branch
    target_branch.head_commit_id = merge_commit.id

    # If note is on target branch, update working copy
    if note.current_branch_id == target_branch.id:
        note.title = final_title
        note.content = final_content

    # Save to history
    merge_log = GitMergeHistory(
        note_id=note.id,
        source_branch=source_branch.name,
        target_branch=target_branch.name,
        merged_commit=merge_commit.id
    )
    db.add(merge_log)
    db.commit()

    return {
        "status": "success",
        "message": "Merged successfully.",
        "merged_commit_id": merge_commit.id
    }


def cherry_pick_commit_action(db: Session, note: Note, commit_id: str, user_id: int) -> Tuple[GitCommit, bool]:
    """
    Cherry-picks a single commit onto the note's active branch.
    Returns (new_commit, has_conflicts).
    """
    ensure_git_init(db, note, user_id)
    active_branch = db.query(GitBranch).filter(GitBranch.id == note.current_branch_id).first()
    head_commit = db.query(GitCommit).filter(GitCommit.id == active_branch.head_commit_id).first()

    cherry_commit = db.query(GitCommit).filter(GitCommit.id == commit_id).first()
    if not cherry_commit:
        raise HTTPException(status_code=404, detail="Cherry-pick commit not found.")

    # Parent of cherry-pick is the ancestor
    ancestor_title, ancestor_content = "", ""
    if cherry_commit.parent_commit:
        parent = db.query(GitCommit).filter(GitCommit.id == cherry_commit.parent_commit).first()
        if parent:
            snap = json.loads(parent.snapshot)
            ancestor_title = snap.get("title", "")
            ancestor_content = snap.get("content", "")

    # Target is current HEAD
    target_snap = json.loads(head_commit.snapshot) if head_commit else {"title": "", "content": ""}
    target_title = target_snap.get("title", "")
    target_content = target_snap.get("content", "")

    # Source is cherry-picked commit
    source_snap = json.loads(cherry_commit.snapshot)
    source_title = source_snap.get("title", "")
    source_content = source_snap.get("content", "")

    merged_title, title_conflict = three_way_merge(ancestor_title, target_title, source_title, active_branch.name, "Cherry-pick")
    merged_content, content_conflict = three_way_merge(ancestor_content, target_content, source_content, active_branch.name, "Cherry-pick")

    has_conflict = title_conflict or content_conflict

    # Create new commit
    new_snapshot = json.dumps({"title": merged_title, "content": merged_content})
    new_commit = GitCommit(
        note_id=note.id,
        branch_id=active_branch.id,
        parent_commit=head_commit.id if head_commit else None,
        message=f"Cherry-picked: {cherry_commit.message}",
        snapshot=new_snapshot,
        author_id=user_id,
        is_checkpoint=True,
        metadata_json=json.dumps({
            "cherry_picked_from": cherry_commit.id,
            "has_conflicts": has_conflict
        })
    )
    db.add(new_commit)
    db.flush()

    # Update HEAD and note working copy
    active_branch.head_commit_id = new_commit.id
    note.title = merged_title
    note.content = merged_content
    db.commit()
    db.refresh(new_commit)

    return new_commit, has_conflict


def get_commit_history(
    db: Session,
    note_id: int,
    query: Optional[str] = None,
    author: Optional[str] = None,
    branch_id: Optional[int] = None,
    tag: Optional[str] = None
) -> List[GitCommit]:
    """Retrieves all commits for a note with optional search filters."""
    q = db.query(GitCommit).filter(GitCommit.note_id == note_id)
    
    if branch_id:
        q = q.filter(GitCommit.branch_id == branch_id)
    if query:
        q = q.filter(GitCommit.message.ilike(f"%{query}%"))
    if author:
        q = q.join(User).filter(User.username.ilike(f"%{author}%") | User.full_name.ilike(f"%{author}%"))
    if tag:
        q = q.join(GitTag).filter(GitTag.name.ilike(f"%{tag}%"))
        
    return q.order_by(GitCommit.created_at.desc()).all()


def compute_word_diff(line_a: str, line_b: str) -> Tuple[str, str]:
    """Calculates word-level difference within a modified line and wraps changes in span tags."""
    import difflib
    words_a = line_a.split(" ")
    words_b = line_b.split(" ")
    sm = difflib.SequenceMatcher(None, words_a, words_b)

    html_a, html_b = [], []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            chunk_a = " ".join(words_a[i1:i2])
            chunk_b = " ".join(words_b[j1:j2])
            html_a.append(chunk_a)
            html_b.append(chunk_b)
        elif tag == 'replace':
            chunk_a = " ".join(words_a[i1:i2])
            chunk_b = " ".join(words_b[j1:j2])
            html_a.append(f"<span class='diff-word-deleted'>{chunk_a}</span>")
            html_b.append(f"<span class='diff-word-added'>{chunk_b}</span>")
        elif tag == 'delete':
            chunk_a = " ".join(words_a[i1:i2])
            html_a.append(f"<span class='diff-word-deleted'>{chunk_a}</span>")
        elif tag == 'insert':
            chunk_b = " ".join(words_b[j1:j2])
            html_b.append(f"<span class='diff-word-added'>{chunk_b}</span>")

    return " ".join(html_a), " ".join(html_b)


def compute_side_by_side_diff(text_a: str, text_b: str) -> List[Dict[str, Any]]:
    """Aligns two texts line-by-line using SequenceMatcher and highlights word changes."""
    import difflib
    lines_a = text_a.splitlines()
    lines_b = text_b.splitlines()

    sm = difflib.SequenceMatcher(None, lines_a, lines_b)
    diff_blocks = []

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for i, j in zip(range(i1, i2), range(j1, j2)):
                diff_blocks.append({
                    "type": "equal",
                    "left": lines_a[i],
                    "right": lines_b[j]
                })
        elif tag == 'replace':
            len_a = i2 - i1
            len_b = j2 - j1
            max_len = max(len_a, len_b)
            for idx in range(max_len):
                left_val = lines_a[i1 + idx] if idx < len_a else None
                right_val = lines_b[j1 + idx] if idx < len_b else None
                
                if left_val is not None and right_val is not None:
                    # Highlight word-level differences
                    left_html, right_html = compute_word_diff(left_val, right_val)
                    diff_blocks.append({
                        "type": "modified",
                        "left": left_html,
                        "right": right_html
                    })
                elif left_val is not None:
                    diff_blocks.append({
                        "type": "deleted",
                        "left": left_val,
                        "right": None
                    })
                elif right_val is not None:
                    diff_blocks.append({
                        "type": "added",
                        "left": None,
                        "right": right_val
                    })
        elif tag == 'delete':
            for i in range(i1, i2):
                diff_blocks.append({
                    "type": "deleted",
                    "left": lines_a[i],
                    "right": None
                })
        elif tag == 'insert':
            for j in range(j1, j2):
                diff_blocks.append({
                    "type": "added",
                    "left": None,
                    "right": lines_b[j]
                })
    return diff_blocks


def get_diff(db: Session, note: Note, commit_a_id: Optional[str], commit_b_id: str) -> List[Dict[str, Any]]:
    """Gets aligned diff between two commits, or working copy and commit B."""
    text_a = ""
    # Retrieve Commit A
    if commit_a_id:
        commit_a = db.query(GitCommit).filter(GitCommit.id == commit_a_id, GitCommit.note_id == note.id).first()
        if commit_a:
            snap = json.loads(commit_a.snapshot)
            text_a = snap.get("content", "")
    else:
        # Compare working copy
        text_a = note.content

    # Retrieve Commit B
    commit_b = db.query(GitCommit).filter(GitCommit.id == commit_b_id, GitCommit.note_id == note.id).first()
    if not commit_b:
        raise HTTPException(status_code=404, detail="Commit B not found.")
    snap_b = json.loads(commit_b.snapshot)
    text_b = snap_b.get("content", "")

    return compute_side_by_side_diff(text_a, text_b)


def compute_timeline_graph(db: Session, note_id: int) -> List[Dict[str, Any]]:
    """Calculates chronological commit nodes with SVG column/track index mappings."""
    commits = db.query(GitCommit).filter(GitCommit.note_id == note_id).order_by(GitCommit.created_at.asc()).all()
    
    branch_tracks = {}
    next_track = 0

    # Ensure main gets track 0
    main_branch = db.query(GitBranch).filter(GitBranch.note_id == note_id, GitBranch.name == "main").first()
    if main_branch:
        branch_tracks[main_branch.id] = 0
        next_track = 1

    timeline = []
    for c in commits:
        if c.branch_id not in branch_tracks:
            branch_tracks[c.branch_id] = next_track
            next_track += 1

        b_name = c.branch.name if c.branch else "detached"
        tags = [t.name for t in c.commit_tags]

        timeline.append({
            "id": c.id,
            "message": c.message,
            "parent_commit": c.parent_commit,
            "created_at": c.created_at.isoformat(),
            "author": c.author.username if c.author else "System",
            "branch_id": c.branch_id,
            "branch_name": b_name,
            "track": branch_tracks.get(c.branch_id, 0),
            "tags": tags,
            "is_favorite": c.is_favorite,
            "is_checkpoint": c.is_checkpoint,
            "metadata": json.loads(c.metadata_json) if c.metadata_json else {}
        })

    timeline.reverse()
    return timeline


def create_tag(db: Session, note: Note, commit_id: str, name: str) -> GitTag:
    """Tags a specific commit in the note history."""
    commit = db.query(GitCommit).filter(GitCommit.id == commit_id, GitCommit.note_id == note.id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found.")

    # Remove existing tags with the same name on this note to avoid duplicates
    db.query(GitTag).join(GitCommit).filter(
        GitCommit.note_id == note.id,
        GitTag.name == name
    ).delete(synchronize_session=False)

    tag = GitTag(
        commit_id=commit.id,
        name=name
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def restore_commit(db: Session, note: Note, commit_id: str, user_id: int) -> Note:
    """Restores the note working copy to match the snapshot of target commit (creates a new commit)."""
    commit = db.query(GitCommit).filter(
        GitCommit.id == commit_id,
        GitCommit.note_id == note.id
    ).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found.")

    snap = json.loads(commit.snapshot)
    note.title = snap.get("title", "")
    note.content = snap.get("content", "")

    # Create a revert/restore commit
    create_commit(
        db, note,
        message=f"Restored to commit {commit.id[:8]}",
        user_id=user_id,
        is_checkpoint=True,
        metadata={"manual": True, "device": "Web Browser"}
    )
    db.commit()
    return note


def toggle_favorite(db: Session, commit_id: str, is_favorite: bool) -> GitCommit:
    """Stars or unstars a commit."""
    commit = db.query(GitCommit).filter(GitCommit.id == commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found.")
    commit.is_favorite = is_favorite
    db.commit()
    db.refresh(commit)
    return commit


def maybe_auto_commit(db: Session, note: Note, user_id: int, pre_ai: bool = False) -> Optional[GitCommit]:
    """Evaluates the note's settings and auto-commits the working copy if thresholds are exceeded."""
    ensure_git_init(db, note, user_id)
    
    branch = db.query(GitBranch).filter(GitBranch.id == note.current_branch_id).first()
    if not branch or not branch.head_commit_id:
        return None

    head_commit = db.query(GitCommit).filter(GitCommit.id == branch.head_commit_id).first()
    if not head_commit:
        return None

    snap = json.loads(head_commit.snapshot)
    head_title = snap.get("title", "")
    head_content = snap.get("content", "")

    # If working copy matches HEAD, no changes to commit
    if note.title == head_title and note.content == head_content:
        return None

    commit_required = False
    message = "Auto-commit: Interval snapshot"

    # Pre-AI generation checkpoint
    if pre_ai and note.auto_commit_before_ai:
        commit_required = True
        message = "Before AI modification"

    # Timer-based checkpoint
    if not commit_required and note.auto_commit_enabled:
        time_elapsed = datetime.now(timezone.utc) - head_commit.created_at.replace(tzinfo=timezone.utc)
        if time_elapsed.total_seconds() >= (note.auto_commit_interval * 60):
            commit_required = True
            message = f"Auto-commit: {note.auto_commit_interval} minutes snapshot"

    # Delta changes check (> 100 chars difference)
    if not commit_required and note.auto_commit_on_major_edit:
        char_diff = abs(len(note.content) - len(head_content))
        if char_diff > 100:
            commit_required = True
            message = "Auto-commit: Major edit snapshot"

    if commit_required:
        return create_commit(
            db, note, message, user_id,
            is_checkpoint=True if pre_ai else False,
            metadata={"manual": False}
        )

    return None


def generate_note_history_pdf(
    note_title: str,
    commits: List[GitCommit],
    branches: List[GitBranch]
) -> bytes:
    """Generates a professional ReportLab PDF showing commit log timeline details."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=HexColor('#FFA116'),
        spaceAfter=15,
        alignment=0 # Left aligned
    )
    
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=HexColor('#222222'),
        spaceAfter=8,
        spaceBefore=12
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=HexColor('#555555'),
        spaceAfter=6
    )

    story.append(Paragraph(f"Version History Log: {note_title}", title_style))
    story.append(Spacer(1, 10))
    
    # Render branches
    story.append(Paragraph("Branches:", h2_style))
    for b in branches:
        story.append(Paragraph(f"• <b>{b.name}</b> (HEAD: {b.head_commit_id[:8] if b.head_commit_id else 'None'})", body_style))
    
    story.append(Spacer(1, 10))
    story.append(Paragraph("Commit History Timeline:", h2_style))
    
    # Commits Table
    table_data = [["Commit ID", "Branch", "Commit Message", "Author", "Timestamp"]]
    
    branch_map = {b.id: b.name for b in branches}
    
    for c in commits:
        b_name = branch_map.get(c.branch_id, "detached")
        table_data.append([
            c.id[:8],
            b_name,
            c.message,
            c.author.username if c.author else "System",
            c.created_at.strftime("%Y-%m-%d %H:%M")
        ])
        
    t = Table(table_data, colWidths=[60, 80, 200, 80, 110])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#FFA116')),
        ('TEXTCOLOR', (0,0), (-1,0), HexColor('#1A1A1A')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('TEXTCOLOR', (0,1), (-1,-1), HexColor('#222222')),
    ]))
    story.append(t)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
