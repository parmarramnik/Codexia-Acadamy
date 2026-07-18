# NoteAI — AI Powered Knowledge Management Platform

## New Feature: Git for Notes Version Control

This feature transforms standard notes in NoteAI into independent Git repositories. Every note maintains a working copy, commits, branches, merges, checkouts, tags, starred states, and aligned diff comparisons.

---

### Core Git-Inspired Architecture

Every note behaves exactly like a separate Git repository:
- **Working Copy**: Represented by the `title` and `content` columns in the `notes` table. Modifying the note in the editor changes the working copy.
- **Branches**: Refered to as references pointing to specific commits. The default branch is `main`. Switching branches restores the note's title and content to the head commit of the selected branch.
- **Commits**: Permanent snapshots of the note's state. When you commit, a new snapshot is created, and the branch HEAD advances. History is append-only and never deleted.
- **HEAD Reference**: The active branch is tracked via the `current_branch_id` column in the `notes` table.

---

### Database Schema

Four new tables support version control:

#### 1. `git_branches`
- `id` (Integer, Primary Key)
- `note_id` (Integer, ForeignKey to `notes.id` on delete CASCADE)
- `name` (String, e.g., "main", "dev")
- `head_commit_id` (String(36), ForeignKey to `git_commits.id` on delete SET NULL)
- `created_at` (DateTime)
- `created_by` (Integer, ForeignKey to `users.id` on delete CASCADE)

#### 2. `git_commits`
- `id` (String(36), UUID, Primary Key)
- `note_id` (Integer, ForeignKey to `notes.id` on delete CASCADE)
- `branch_id` (Integer, ForeignKey to `git_branches.id` on delete SET NULL)
- `parent_commit` (String(36), ForeignKey to `git_commits.id` on delete SET NULL)
- `message` (String, description of changes)
- `snapshot` (Text, JSON payload `{"title": ..., "content": ...}`)
- `created_at` (DateTime)
- `author_id` (Integer, ForeignKey to `users.id` on delete CASCADE)
- `metadata_json` (Text, stores stats like word count, character count, read time, device, manual vs auto)
- `is_favorite` (Boolean, starred commit)
- `is_checkpoint` (Boolean, marked milestone)

#### 3. `git_tags`
- `id` (Integer, Primary Key)
- `commit_id` (String(36), ForeignKey to `git_commits.id` on delete CASCADE)
- `name` (String, e.g., "v1.0", "Final Exam")
- `created_at` (DateTime)

#### 4. `git_merge_history`
- `id` (Integer, Primary Key)
- `note_id` (Integer, ForeignKey to `notes.id` on delete CASCADE)
- `source_branch` (String, source branch name)
- `target_branch` (String, target branch name)
- `merged_commit` (String(36), ForeignKey to `git_commits.id` on delete CASCADE)
- `merged_at` (DateTime)

---

### API Endpoints

All endpoints are scoped to the authenticated user and prefix `/api/git`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/git/commit` | Commits current note working copy changes. |
| `POST` | `/api/git/branch` | Creates a new branch from active HEAD. |
| `POST` | `/api/git/checkout` | Switches branches (warns if uncommitted changes exist). |
| `POST` | `/api/git/merge` | Merges two branches. Handles FF or resolves conflicts. |
| `POST` | `/api/git/cherry-pick`| Cherry-picks a commit onto the active branch. |
| `GET`  | `/api/git/history` | Fetches filtered history of commits. |
| `GET`  | `/api/git/branches` | Lists all branches of a note. |
| `GET`  | `/api/git/diff` | Returns side-by-side diff hunks with word-level highlight. |
| `GET`  | `/api/git/compare` | Compares two branches for merge pre-verification. |
| `GET`  | `/api/git/timeline` | Returns reverse chronological timeline with graph tracks. |
| `POST` | `/api/git/tag` | Tags (pins) a commit. |
| `POST` | `/api/git/restore` | Reverts working copy to a commit (creates revert commit). |
| `POST` | `/api/git/commit/{id}/favorite` | Stars/unstars a commit. |
| `GET`  | `/api/git/ai-summary` | Asks Gemini to suggest a commit summary from changes. |
| `GET`  | `/api/git/export` | Exports history to JSON, Markdown, or PDF. |

---

### Key Workflows

#### 1. Commit Flow
1. User makes edits in the workspace.
2. Clicking **Commit** saves the working copy changes and posts to `/api/git/commit`.
3. If **Auto-Commit** settings are enabled, the backend automatically runs timer checks (e.g. 30-min intervals) or delta thresholds (> 100 character changes) on save, auto-committing modifications.

#### 2. Branch Flow
1. User clicks **Branch**, enters a name, and creates it. The new branch points to the active HEAD commit.
2. The user can checkout branches. If they try to checkout with unsaved changes, the app blocks and prompts the user. Passing `force=True` bypasses and discards unsaved changes.

#### 3. Merge & Conflict Flow
1. Merging branch A into branch B calculates their **Lowest Common Ancestor** (LCA).
2. If B has no changes since LCA, it performs a **Fast-Forward Merge** by moving B's HEAD reference to A's HEAD.
3. If both modified since LCA:
   - Line-by-line checks run. If changes are non-conflicting, they are merged.
   - If changes overlap, the merge blocks, returning conflict details.
   - The user opens the **Merge Editor Dialog** and selects a strategy: `keep_target` (Keep B), `keep_source` (Keep A), `merge_both` (concatenate), or `custom` (custom text). A merge commit is created with the resolved payload.
