import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
  FiBook, FiPlus, FiTrash2, FiBookmark, FiSearch, FiCheck, FiArrowLeft,
  FiGitBranch, FiGitCommit, FiGitMerge, FiTag, FiStar, FiClock, FiSettings,
  FiDownload, FiCpu, FiEdit3, FiEye, FiCheckCircle, FiActivity
} from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [showCreate, setShowCreate] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', course_id: '' });

  // Workspace / Git Mode states
  const [selectedNote, setSelectedNote] = useState(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorCourseId, setEditorCourseId] = useState('');
  const [branches, setBranches] = useState([]);
  const [commits, setCommits] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [activeTab, setActiveTab] = useState('history'); // history, branches, diff, settings
  const [gitSearchQuery, setGitSearchQuery] = useState('');

  // Commit form state
  const [commitMessage, setCommitMessage] = useState('');
  const [isCheckpoint, setIsCheckpoint] = useState(false);
  const [isAICommitting, setIsAICommitting] = useState(false);

  // Custom loading button states
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingCommit, setIsCreatingCommit] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isConflictResolving, setIsConflictResolving] = useState(false);
  const [isTagging, setIsTagging] = useState(false);

  // Branch dialog state
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  // Checkout warning state
  const [showCheckoutWarning, setShowCheckoutWarning] = useState(false);
  const [pendingBranchId, setPendingBranchId] = useState(null);

  // Tag dialog state
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagCommitId, setTagCommitId] = useState(null);

  // Merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // Conflict state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [resolveStrategy, setResolveStrategy] = useState('keep_target'); // keep_target, keep_source, merge_both, custom
  const [customResolveContent, setCustomResolveContent] = useState('');
  const [customResolveTitle, setCustomResolveTitle] = useState('');

  // Diff state
  const [diffCommitA, setDiffCommitA] = useState('');
  const [diffCommitB, setDiffCommitB] = useState('');
  const [diffHunks, setDiffHunks] = useState([]);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  // Auto commit states
  const [autoCommitEnabled, setAutoCommitEnabled] = useState(false);
  const [autoCommitInterval, setAutoCommitInterval] = useState(30);
  const [autoCommitOnMajorEdit, setAutoCommitOnMajorEdit] = useState(true);
  const [autoCommitBeforeAi, setAutoCommitBeforeAi] = useState(true);

  async function loadData() {
    setIsLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedCourse) params.course_id = selectedCourse;
      if (showBookmarkedOnly) params.bookmarked = true;

      const [notesRes, coursesRes] = await Promise.all([
        api.get('/notes', { params }),
        api.get('/courses')
      ]);

      setNotes(notesRes.data || []);
      setCourses(coursesRes.data.items || []);
      if (coursesRes.data.items?.length > 0 && !newNote.course_id) {
        setNewNote(prev => ({ ...prev, course_id: coursesRes.data.items[0].id }));
      }
    } catch (err) {
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, selectedCourse, showBookmarkedOnly]);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNote.title || !newNote.content) {
      toast.error('Please enter a title and content');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post('/notes', {
        title: newNote.title,
        content: newNote.content,
        course_id: newNote.course_id ? parseInt(newNote.course_id) : null
      });
      toast.success('Note saved successfully!');
      setShowCreate(false);
      setNewNote({ title: '', content: '', course_id: courses[0]?.id || '' });
      // Automatically open the workspace for the new note
      handleOpenWorkspace(res.data);
    } catch (err) {
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBookmark = async (noteId, currentStatus) => {
    try {
      await api.put(`/notes/${noteId}`, {
        is_bookmarked: !currentStatus
      });
      toast.success(!currentStatus ? 'Bookmarked' : 'Bookmark removed');
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(prev => ({ ...prev, is_bookmarked: !currentStatus }));
      }
      loadData();
    } catch (err) {
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/notes/${noteId}`);
      toast.success('Note deleted');
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(null);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  // --- Workspace Mode Logic ---

  const handleOpenWorkspace = async (note) => {
    setSelectedNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorCourseId(note.course_id || '');
    
    // Set auto-commit states
    setAutoCommitEnabled(note.auto_commit_enabled);
    setAutoCommitInterval(note.auto_commit_interval);
    setAutoCommitOnMajorEdit(note.auto_commit_on_major_edit);
    setAutoCommitBeforeAi(note.auto_commit_before_ai);
    
    await loadGitDetails(note.id);
  };

  const handleExitWorkspace = () => {
    if (editorContent !== selectedNote.content || editorTitle !== selectedNote.title) {
      if (!window.confirm('You have unsaved changes. Exit anyway?')) return;
    }
    setSelectedNote(null);
    loadData();
  };

  const loadGitDetails = async (noteId) => {
    try {
      const [branchesRes, timelineRes] = await Promise.all([
        api.get(`/git/branches`, { params: { note_id: noteId } }),
        api.get(`/git/timeline`, { params: { note_id: noteId } })
      ]);
      setBranches(branchesRes.data || []);
      setTimeline(timelineRes.data.commits || []);
      setActiveBranchId(timelineRes.data.active_branch_id);
      
      // Default Diff Viewer selections to head commits
      if (timelineRes.data.commits?.length > 0) {
        setDiffCommitB(timelineRes.data.commits[0].id);
        if (timelineRes.data.commits.length > 1) {
          setDiffCommitA(timelineRes.data.commits[1].id);
        } else {
          setDiffCommitA('');
        }
      }
    } catch (err) {
      toast.error('Failed to load version control history');
    }
  };

  const handleSaveWorkingCopy = async () => {
    setIsSaving(true);
    try {
      const res = await api.put(`/notes/${selectedNote.id}`, {
        title: editorTitle,
        content: editorContent,
        course_id: editorCourseId ? parseInt(editorCourseId) : null,
        auto_commit_enabled: autoCommitEnabled,
        auto_commit_interval: parseInt(autoCommitInterval),
        auto_commit_on_major_edit: autoCommitOnMajorEdit,
        auto_commit_before_ai: autoCommitBeforeAi
      });
      setSelectedNote(res.data);
      toast.success('Working copy saved');
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCommit = async (e) => {
    e.preventDefault();
    if (!commitMessage) {
      toast.error('Commit message is required');
      return;
    }

    setIsCreatingCommit(true);
    try {
      // 1. Save working copy first
      await api.put(`/notes/${selectedNote.id}`, {
        title: editorTitle,
        content: editorContent,
        course_id: editorCourseId ? parseInt(editorCourseId) : null
      });

      // 2. Execute commit
      await api.post(`/git/commit`, {
        note_id: selectedNote.id,
        message: commitMessage,
        is_checkpoint: isCheckpoint
      });

      toast.success('Commit successful!');
      setCommitMessage('');
      setIsCheckpoint(false);
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Commit failed');
    } finally {
      setIsCreatingCommit(false);
    }
  };

  const generateAICommitMessage = async () => {
    setIsAICommitting(true);
    try {
      // Ensure current state is saved to compute accurate diff
      await api.put(`/notes/${selectedNote.id}`, {
        title: editorTitle,
        content: editorContent,
        course_id: editorCourseId ? parseInt(editorCourseId) : null
      });

      const res = await api.get(`/git/ai-summary`, {
        params: { note_id: selectedNote.id }
      });
      setCommitMessage(res.data.summary);
      toast.success('AI summary generated!');
    } catch (err) {
      toast.error('AI summary failed');
    } finally {
      setIsAICommitting(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName) return;

    setIsCreatingBranch(true);
    try {
      await api.post(`/git/branch`, {
        note_id: selectedNote.id,
        name: newBranchName
      });
      toast.success(`Branch '${newBranchName}' created`);
      setNewBranchName('');
      setShowBranchDialog(false);
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create branch');
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const handleCheckoutBranch = async (branchId, force = false) => {
    setIsCheckingOut(true);
    try {
      const res = await api.post(`/git/checkout`, {
        note_id: selectedNote.id,
        branch_id: branchId,
        force: force
      });

      if (res.data.unsaved_changes) {
        setPendingBranchId(branchId);
        setShowCheckoutWarning(true);
        return;
      }

      toast.success(res.data.message);
      setShowCheckoutWarning(false);
      setPendingBranchId(null);
      
      // Reload working copy from the checkout response
      const updatedNoteRes = await api.get(`/notes`);
      const matched = updatedNoteRes.data.find(n => n.id === selectedNote.id);
      if (matched) {
        setSelectedNote(matched);
        setEditorTitle(matched.title);
        setEditorContent(matched.content);
      }
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleMergeBranches = async (e) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId) {
      toast.error('Source and Target branches are required');
      return;
    }

    setIsMerging(true);
    try {
      const res = await api.post(`/git/merge`, {
        note_id: selectedNote.id,
        source_branch_id: parseInt(mergeSourceId),
        target_branch_id: parseInt(mergeTargetId)
      });

      if (res.data.status === 'conflict') {
        setConflictInfo({
          source_branch_id: parseInt(mergeSourceId),
          target_branch_id: parseInt(mergeTargetId),
          conflict_content: res.data.conflict_content,
          target_content: res.data.target_content,
          source_content: res.data.source_content,
          ancestor_content: res.data.ancestor_content
        });
        setCustomResolveContent(res.data.conflict_content);
        setCustomResolveTitle(editorTitle);
        setShowMergeDialog(false);
        setShowConflictDialog(true);
        toast.error('Merge conflict detected. Please resolve.');
        return;
      }

      toast.success(res.data.message);
      setShowMergeDialog(false);
      
      // Sync working copy
      const updatedNoteRes = await api.get(`/notes`);
      const matched = updatedNoteRes.data.find(n => n.id === selectedNote.id);
      if (matched) {
        setSelectedNote(matched);
        setEditorTitle(matched.title);
        setEditorContent(matched.content);
      }
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Merge failed');
    } finally {
      setIsMerging(false);
    }
  };

  const handleResolveConflict = async () => {
    setIsConflictResolving(true);
    try {
      const res = await api.post(`/git/merge`, {
        note_id: selectedNote.id,
        source_branch_id: conflictInfo.source_branch_id,
        target_branch_id: conflictInfo.target_branch_id,
        resolve_strategy: resolveStrategy,
        custom_content: resolveStrategy === 'custom' ? customResolveContent : null,
        custom_title: resolveStrategy === 'custom' ? customResolveTitle : null
      });

      toast.success(res.data.message);
      setShowConflictDialog(false);
      setConflictInfo(null);
      
      // Sync working copy
      const updatedNoteRes = await api.get(`/notes`);
      const matched = updatedNoteRes.data.find(n => n.id === selectedNote.id);
      if (matched) {
        setSelectedNote(matched);
        setEditorTitle(matched.title);
        setEditorContent(matched.content);
      }
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Resolution failed');
    } finally {
      setIsConflictResolving(false);
    }
  };

  const handleCherryPick = async (commitId) => {
    if (!window.confirm('Cherry-pick this commit changes to active branch?')) return;
    setIsCherryPicking(true);
    try {
      const res = await api.post(`/git/cherry-pick`, {
        note_id: selectedNote.id,
        commit_id: commitId
      });

      if (res.data.has_conflicts) {
        toast.warning('Cherry-pick conflict occurred. Conflict markers inserted in editor.');
      } else {
        toast.success('Cherry-pick successful!');
      }

      // Sync working copy
      const updatedNoteRes = await api.get(`/notes`);
      const matched = updatedNoteRes.data.find(n => n.id === selectedNote.id);
      if (matched) {
        setSelectedNote(matched);
        setEditorTitle(matched.title);
        setEditorContent(matched.content);
      }
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Cherry-pick failed');
    } finally {
      setIsCherryPicking(false);
    }
  };

  const handleRestoreCommit = async (commitId) => {
    if (!window.confirm('Revert working copy to match this commit? This will make a new commit.')) return;
    try {
      const res = await api.post(`/git/restore`, {
        note_id: selectedNote.id,
        commit_id: commitId
      });
      setSelectedNote(res.data);
      setEditorTitle(res.data.title);
      setEditorContent(res.data.content);
      toast.success('Revert commit completed');
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Restore failed');
    }
  };

  const handleToggleFavorite = async (commitId, currentFav) => {
    try {
      await api.post(`/git/commit/${commitId}/favorite`, null, {
        params: { is_favorite: !currentFav }
      });
      toast.success(!currentFav ? 'Starred commit' : 'Unstarred commit');
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Failed to star commit');
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!tagName || !tagCommitId) return;

    setIsTagging(true);
    try {
      await api.post(`/git/tag`, {
        note_id: selectedNote.id,
        commit_id: tagCommitId,
        name: tagName
      });
      toast.success(`Tag '${tagName}' added`);
      setTagName('');
      setTagCommitId(null);
      setShowTagDialog(false);
      await loadGitDetails(selectedNote.id);
    } catch (err) {
      toast.error('Failed to add tag');
    } finally {
      setIsTagging(false);
    }
  };

  const loadDiff = async () => {
    if (!diffCommitB) return;
    setIsDiffLoading(true);
    try {
      const res = await api.get(`/git/diff`, {
        params: {
          note_id: selectedNote.id,
          commit_b: diffCommitB,
          commit_a: diffCommitA || undefined
        }
      });
      setDiffHunks(res.data || []);
    } catch (err) {
      toast.error('Failed to load differences');
    } finally {
      setIsDiffLoading(false);
    }
  };

  useEffect(() => {
    if (selectedNote && activeTab === 'diff') {
      loadDiff();
    }
  }, [diffCommitA, diffCommitB, activeTab]);

  const handleExport = (format) => {
    const url = `${api.defaults.baseURL}/git/export?note_id=${selectedNote.id}&format=${format}`;
    // Attach authentication header using a window.open or fetch download
    const token = localStorage.getItem('access_token');
    
    // To trigger browser download with headers, we fetch it first as a blob
    toast.promise(
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        const extensions = { json: 'json', markdown: 'md', pdf: 'pdf' };
        link.download = `note_${selectedNote.id}_history.${extensions[format]}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }),
      {
        loading: `Exporting note history to ${format.toUpperCase()}...`,
        success: 'Export downloaded!',
        error: 'Export failed'
      }
    );
  };

  // Timeline SVG calculations
  const renderTimelineGraph = () => {
    const maxTrack = Math.max(...timeline.map(c => c.track), 0);
    const svgWidth = (maxTrack + 1) * 24 + 16;
    const svgHeight = timeline.length * 80;

    return (
      <svg width={svgWidth} height={svgHeight} style={styles.svgTimeline}>
        {timeline.map((commit, idx) => {
          const cy = idx * 80 + 36;
          const cx = commit.track * 24 + 16;

          // Find parent index and coordinates
          let parentLine = null;
          if (commit.parent_commit) {
            const parentIdx = timeline.findIndex(c => c.id === commit.parent_commit);
            if (parentIdx !== -1) {
              const pCommit = timeline[parentIdx];
              const pcy = parentIdx * 80 + 36;
              const pcx = pCommit.track * 24 + 16;

              // Draw path from parent to child
              parentLine = (
                <path
                  key={`path-${commit.id}`}
                  d={`M ${pcx} ${pcy} C ${pcx} ${(pcy + cy) / 2}, ${cx} ${(pcy + cy) / 2}, ${cx} ${cy}`}
                  stroke="var(--border-light)"
                  strokeWidth="2"
                  fill="none"
                />
              );
            }
          }

          // Same-track connector line going down if not the last item
          const trackLine = idx < timeline.length - 1 ? (
            <line
              key={`line-down-${commit.id}`}
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy + 80}
              stroke="var(--border-light)"
              strokeWidth="2"
            />
          ) : null;

          return (
            <g key={`group-${commit.id}`}>
              {trackLine}
              {parentLine}
              <circle
                cx={cx}
                cy={cy}
                r="6"
                fill={commit.is_checkpoint ? "var(--color-warning)" : "var(--accent-primary)"}
                stroke="var(--bg-primary)"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setDiffCommitB(commit.id);
                  setActiveTab('diff');
                }}
              />
            </g>
          );
        })}
      </svg>
    );
  };

  const activeBranchName = branches.find(b => b.id === activeBranchId)?.name || 'main';

  if (isLoading && notes.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading notebook index...</p>
      </div>
    );
  }

  // --- Render Note Workspace (Workspace Workspace Mode) ---
  if (selectedNote) {
    return (
      <div style={styles.workspaceContainer}>
        {/* Workspace Toolbar */}
        <div style={styles.workspaceToolbar}>
          <div style={styles.toolbarLeft}>
            <button onClick={handleExitWorkspace} style={styles.backBtn}>
              <FiArrowLeft size={16} /> Back
            </button>
            <div style={styles.workspaceMeta}>
              <span style={styles.workspaceTitle}>{editorTitle || 'Untitled Note'}</span>
              <span style={styles.activeBranchBadge}>
                <FiGitBranch size={12} /> {activeBranchName}
              </span>
            </div>
          </div>

          <div style={styles.toolbarRight}>
            <LoadingButton onClick={handleSaveWorkingCopy} loading={isSaving} loadingText="Saving..." style={styles.workspaceSecondaryBtn}>
              Save Copy
            </LoadingButton>
            <button onClick={() => setShowMergeDialog(true)} style={styles.workspaceSecondaryBtn}>
              <FiGitMerge size={14} /> Merge
            </button>
            <button onClick={() => setShowBranchDialog(true)} style={styles.workspaceSecondaryBtn}>
              <FiPlus size={14} /> Branch
            </button>
            <div style={styles.exportDropdownContainer}>
              <button style={styles.workspaceSecondaryBtn}>
                <FiDownload size={14} /> Export
              </button>
              <div style={styles.dropdownContent}>
                <button onClick={() => handleExport('json')}>JSON</button>
                <button onClick={() => handleExport('markdown')}>Markdown</button>
                <button onClick={() => handleExport('pdf')}>PDF Document</button>
              </div>
            </div>
          </div>
        </div>

        {/* Split Grid */}
        <div style={styles.workspaceGridSplit}>
          {/* Left panel: Editor Area */}
          <div style={styles.editorPanel}>
            <div style={styles.formGroup}>
              <input
                type="text"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                style={styles.workspaceTitleInput}
                placeholder="Note title..."
              />
            </div>

            <div style={{ ...styles.formGroup, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                style={styles.workspaceContentInput}
                placeholder="Write your markdown note contents here..."
              />
            </div>

            {/* Quick manual commit bar */}
            <form onSubmit={handleCreateCommit} style={styles.quickCommitBar}>
              <input
                type="text"
                placeholder="Commit message (e.g., Added ACID explanation)..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                style={styles.commitInput}
                required
              />
              <button
                type="button"
                onClick={generateAICommitMessage}
                style={styles.aiSummaryBtn}
                title="Generate AI summary of changes"
                disabled={isAICommitting}
              >
                <FiCpu size={16} /> {isAICommitting ? '...' : 'AI'}
              </button>
              <label style={styles.checkpointLabel}>
                <input
                  type="checkbox"
                  checked={isCheckpoint}
                  onChange={(e) => setIsCheckpoint(e.target.checked)}
                />
                Milestone
              </label>
              <LoadingButton type="submit" loading={isCreatingCommit} loadingText="Committing..." style={styles.commitBtn}>
                <FiGitCommit /> Commit
              </LoadingButton>
            </form>
          </div>

          {/* Right panel: Git Control Panel */}
          <div style={styles.gitPanel}>
            {/* Git Panel Navigation */}
            <div style={styles.gitTabs}>
              <button
                onClick={() => setActiveTab('history')}
                style={activeTab === 'history' ? { ...styles.gitTab, ...styles.gitTabActive } : styles.gitTab}
              >
                <FiClock /> History
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                style={activeTab === 'branches' ? { ...styles.gitTab, ...styles.gitTabActive } : styles.gitTab}
              >
                <FiGitBranch /> Branches
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                style={activeTab === 'diff' ? { ...styles.gitTab, ...styles.gitTabActive } : styles.gitTab}
              >
                <FiEye /> Diff
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                style={activeTab === 'settings' ? { ...styles.gitTab, ...styles.gitTabActive } : styles.gitTab}
              >
                <FiSettings /> Options
              </button>
            </div>

            {/* Tab content */}
            <div style={styles.gitTabContent}>
              {activeTab === 'history' && (
                <div style={styles.historyTab}>
                  <div style={styles.gitSearchBox}>
                    <FiSearch style={styles.searchIconInside} />
                    <input
                      type="text"
                      placeholder="Search commits by message or tag..."
                      value={gitSearchQuery}
                      onChange={(e) => setGitSearchQuery(e.target.value)}
                      style={styles.gitSearchInput}
                    />
                  </div>

                  <div style={styles.timelineScroller}>
                    <div style={styles.timelineFlexGrid}>
                      {/* Left: Commit Graph */}
                      {renderTimelineGraph()}

                      {/* Right: Commit detail cards */}
                      <div style={styles.commitDetailsList}>
                        {timeline
                          .filter(c =>
                            c.message.toLowerCase().includes(gitSearchQuery.toLowerCase()) ||
                            c.tags.some(t => t.toLowerCase().includes(gitSearchQuery.toLowerCase()))
                          )
                          .map((commit) => (
                            <div key={commit.id} style={styles.commitCard}>
                              <div style={styles.commitCardHeader}>
                                <span style={styles.commitMessageText}>{commit.message}</span>
                                <div style={styles.commitActionsRow}>
                                  <button
                                    onClick={() => handleToggleFavorite(commit.id, commit.is_favorite)}
                                    style={commit.is_favorite ? { ...styles.iconBtn, color: 'var(--color-warning)' } : styles.iconBtn}
                                    title="Star commit"
                                  >
                                    <FiStar />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTagCommitId(commit.id);
                                      setShowTagDialog(true);
                                    }}
                                    style={styles.iconBtn}
                                    title="Tag commit"
                                  >
                                    <FiTag />
                                  </button>
                                  <button
                                    onClick={() => handleCherryPick(commit.id)}
                                    style={styles.iconBtn}
                                    title="Cherry pick changes"
                                  >
                                    <FiGitMerge />
                                  </button>
                                  <button
                                    onClick={() => handleRestoreCommit(commit.id)}
                                    style={styles.iconBtn}
                                    title="Revert to this snapshot"
                                  >
                                    <FiCheckCircle />
                                  </button>
                                </div>
                              </div>
                              <div style={styles.commitCardMeta}>
                                <span>{commit.id.substring(0, 8)}</span>
                                <span>•</span>
                                <span>{commit.author}</span>
                                <span>•</span>
                                <span>{new Date(commit.created_at).toLocaleDateString()}</span>
                              </div>
                              {commit.tags.length > 0 && (
                                <div style={styles.tagBadgeRow}>
                                  {commit.tags.map(t => (
                                    <span key={t} style={styles.tagBadge}>
                                      <FiTag size={10} /> {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {commit.metadata && (
                                <div style={styles.commitStatsMeta}>
                                  <span>Words: {commit.metadata.word_count}</span>
                                  <span>Chars: {commit.metadata.char_count}</span>
                                  <span>Read time: {commit.metadata.reading_time}m</span>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'branches' && (
                <div style={styles.branchesTab}>
                  <h3 style={styles.gitTabHeading}>Select Branch</h3>
                  <div style={styles.branchList}>
                    {branches.map((b) => (
                      <div
                        key={b.id}
                        style={b.id === activeBranchId ? { ...styles.branchItem, ...styles.branchItemActive } : styles.branchItem}
                      >
                        <div style={styles.branchItemLeft}>
                          <FiGitBranch size={16} />
                          <span style={styles.branchItemName}>{b.name}</span>
                        </div>
                        {b.id !== activeBranchId ? (
                          <button
                            onClick={() => handleCheckoutBranch(b.id)}
                            style={styles.checkoutBtn}
                          >
                            Checkout
                          </button>
                        ) : (
                          <span style={styles.activeLabel}>Active</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'diff' && (
                <div style={styles.diffTab}>
                  <div style={styles.diffSelectorRow}>
                    <div style={styles.selectGroup}>
                      <label style={styles.selectLabel}>Base Commit (A)</label>
                      <select
                        value={diffCommitA}
                        onChange={(e) => setDiffCommitA(e.target.value)}
                        style={styles.diffSelect}
                      >
                        <option value="">Working Copy (Current)</option>
                        {timeline.map(c => (
                          <option key={c.id} value={c.id}>{c.message.substring(0, 30)} ({c.id.substring(0, 6)})</option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.selectGroup}>
                      <label style={styles.selectLabel}>Compare Commit (B)</label>
                      <select
                        value={diffCommitB}
                        onChange={(e) => setDiffCommitB(e.target.value)}
                        style={styles.diffSelect}
                      >
                        {timeline.map(c => (
                          <option key={c.id} value={c.id}>{c.message.substring(0, 30)} ({c.id.substring(0, 6)})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isDiffLoading ? (
                    <div style={styles.diffPlaceholder}>Computing differences...</div>
                  ) : diffHunks.length === 0 ? (
                    <div style={styles.diffPlaceholder}>No modifications found between versions.</div>
                  ) : (
                    <div style={styles.diffViewerContainer}>
                      <div style={styles.diffViewerHeader}>
                        <div style={styles.diffHeaderCol}>Old Copy</div>
                        <div style={styles.diffHeaderCol}>New Copy</div>
                      </div>
                      <div style={styles.diffScroller}>
                        {diffHunks.map((hunk, idx) => (
                          <div
                            key={idx}
                            style={
                              hunk.type === 'added' ? styles.diffRowAdded :
                              hunk.type === 'deleted' ? styles.diffRowDeleted :
                              hunk.type === 'modified' ? styles.diffRowModified :
                              styles.diffRowEqual
                            }
                          >
                            <div
                              style={styles.diffCell}
                              dangerouslySetInnerHTML={{ __html: hunk.left || '' }}
                            />
                            <div
                              style={{ ...styles.diffCell, borderRight: 'none' }}
                              dangerouslySetInnerHTML={{ __html: hunk.right || '' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div style={styles.settingsTab}>
                  <h3 style={styles.gitTabHeading}>Auto Commit Preferences</h3>
                  <div style={styles.settingRow}>
                    <label style={styles.settingLabel}>
                      <input
                        type="checkbox"
                        checked={autoCommitEnabled}
                        onChange={(e) => setAutoCommitEnabled(e.target.checked)}
                      />
                      Enable Auto-Commit timer
                    </label>
                  </div>

                  {autoCommitEnabled && (
                    <div style={styles.settingSubRow}>
                      <label style={styles.subLabel}>Interval (minutes)</label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={autoCommitInterval}
                        onChange={(e) => setAutoCommitInterval(e.target.value)}
                        style={styles.settingInput}
                      />
                    </div>
                  )}

                  <div style={styles.settingRow}>
                    <label style={styles.settingLabel}>
                      <input
                        type="checkbox"
                        checked={autoCommitOnMajorEdit}
                        onChange={(e) => setAutoCommitOnMajorEdit(e.target.checked)}
                      />
                      Commit automatically on major text changes (&gt; 100 chars)
                    </label>
                  </div>

                  <div style={styles.settingRow}>
                    <label style={styles.settingLabel}>
                      <input
                        type="checkbox"
                        checked={autoCommitBeforeAi}
                        onChange={(e) => setAutoCommitBeforeAi(e.target.checked)}
                      />
                      Create checkpoint automatically before AI modifications
                    </label>
                  </div>

                  <LoadingButton onClick={handleSaveWorkingCopy} loading={isSaving} loadingText="Saving..." style={styles.saveSettingsBtn}>
                    Save Preferences
                  </LoadingButton>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CREATE BRANCH DIALOG */}
        {showBranchDialog && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={styles.modalTitle}>Create New Branch</h3>
              <form onSubmit={handleCreateBranch}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Branch Name</label>
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    style={styles.input}
                    placeholder="e.g. exam-prep"
                    required
                  />
                </div>
                <div style={styles.btnRow}>
                  <LoadingButton type="submit" loading={isCreatingBranch} loadingText="Creating..." style={styles.saveBtn}>Create</LoadingButton>
                  <button type="button" onClick={() => setShowBranchDialog(false)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CHECKOUT WARNING DIALOG */}
        {showCheckoutWarning && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={styles.modalTitle}>Uncommitted Changes</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                You have uncommitted modifications in your working copy. Checking out will discard them.
              </p>
              <div style={styles.btnRow}>
                <LoadingButton
                  onClick={() => handleCheckoutBranch(pendingBranchId, true)}
                  loading={isCheckingOut}
                  loadingText="Discarding..."
                  style={{ ...styles.saveBtn, backgroundColor: 'var(--color-error)' }}
                >
                  Discard Changes & Checkout
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckoutWarning(false);
                    setPendingBranchId(null);
                  }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAG DIALOG */}
        {showTagDialog && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={styles.modalTitle}>Add Tag (Pin Version)</h3>
              <form onSubmit={handleAddTag}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tag Name</label>
                  <input
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    style={styles.input}
                    placeholder="e.g. v1.0, Final Draft"
                    required
                  />
                </div>
                <div style={styles.btnRow}>
                  <LoadingButton type="submit" loading={isTagging} loadingText="Tagging..." style={styles.saveBtn}>Tag Commit</LoadingButton>
                  <button type="button" onClick={() => setShowTagDialog(false)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MERGE DIALOG */}
        {showMergeDialog && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={styles.modalTitle}>Merge Branches</h3>
              <form onSubmit={handleMergeBranches}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Merge From (Source Branch)</label>
                  <select
                    value={mergeSourceId}
                    onChange={(e) => setMergeSourceId(e.target.value)}
                    style={styles.selectInput}
                    required
                  >
                    <option value="" disabled hidden>Select Branch...</option>
                    {Array.from(new Map(branches.map(b => [b.name, b])).values())
                      .filter(b => b.id !== parseInt(mergeTargetId))
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))
                    }
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Merge Into (Target Branch)</label>
                  <select
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    style={styles.selectInput}
                    required
                  >
                    <option value="" disabled hidden>Select Branch...</option>
                    {Array.from(new Map(branches.map(b => [b.name, b])).values())
                      .filter(b => b.id !== parseInt(mergeSourceId))
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))
                    }
                  </select>
                </div>
                <div style={styles.btnRow}>
                  <LoadingButton type="submit" loading={isMerging} loadingText="Merging..." style={styles.saveBtn}>Merge</LoadingButton>
                  <button type="button" onClick={() => setShowMergeDialog(false)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MERGE CONFLICT RESOLUTION DIALOG */}
        {showConflictDialog && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalCard, maxWidth: '800px', width: '90%' }}>
              <h3 style={styles.modalTitle}>Merge Conflict Editor</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Overlapping edits detected. Select a resolution strategy to merge changes.
              </p>

              <div style={styles.formGroup}>
                <label style={styles.label}>Resolution Strategy</label>
                <select
                  value={resolveStrategy}
                  onChange={(e) => setResolveStrategy(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="keep_target">Keep Main (Target Branch)</option>
                  <option value="keep_source">Keep Branch (Source Branch)</option>
                  <option value="merge_both">Merge Both (Concatenate content)</option>
                  <option value="custom">Custom Edit (Use conflict editor below)</option>
                </select>
              </div>

              {resolveStrategy === 'custom' && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Custom Title</label>
                    <input
                      type="text"
                      value={customResolveTitle}
                      onChange={(e) => setCustomResolveTitle(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Conflict Editor</label>
                    <textarea
                      value={customResolveContent}
                      onChange={(e) => setCustomResolveContent(e.target.value)}
                      style={styles.textarea}
                      rows="8"
                    />
                  </div>
                </>
              )}

              <div style={{ ...styles.btnRow, marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <LoadingButton onClick={handleResolveConflict} loading={isConflictResolving} loadingText="Resolving..." style={styles.saveBtn}>
                  Resolve Conflict
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => {
                    setShowConflictDialog(false);
                    setConflictInfo(null);
                  }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Normal Note Grid Index ---
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Notebook</h1>
        <p style={styles.subtitle}>Save key definitions, algorithm layouts, and study notes.</p>
      </div>

      <div style={styles.actionRow}>
        <div style={styles.searchBar}>
          <div style={styles.searchWrapper}>
            <FiSearch size={16} style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={styles.select}
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>

          <button
            onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
            style={showBookmarkedOnly ? { ...styles.filterBtn, ...styles.filterBtnActive } : styles.filterBtn}
          >
            <FiBookmark /> {showBookmarkedOnly ? 'Bookmarked' : 'All'}
          </button>
        </div>

        <button onClick={() => setShowCreate(!showCreate)} style={styles.createBtn}>
          <FiPlus /> New Note
        </button>
      </div>

      <div style={styles.workspaceGrid}>
        {/* Create Form card */}
        {showCreate && (
          <form onSubmit={handleCreateNote} style={styles.formCard}>
            <h3 style={styles.sectionHeading}>Add a Note</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Course</label>
              <select
                value={newNote.course_id}
                onChange={(e) => setNewNote({ ...newNote, course_id: e.target.value })}
                style={styles.selectInput}
              >
                <option value="">None / General</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Title</label>
              <input
                type="text"
                placeholder="e.g. Quicksort Time Complexity"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Content</label>
              <textarea
                placeholder="Write your markdown note here..."
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                style={styles.textarea}
                required
              />
            </div>
            <div style={styles.btnRow}>
              <LoadingButton type="submit" loading={isSaving} loadingText="Saving Note..." style={styles.saveBtn}>Save Note</LoadingButton>
              <button type="button" onClick={() => setShowCreate(false)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </form>
        )}

        {/* Notes Grid */}
        <div style={styles.notesGrid}>
          {notes.length === 0 ? (
            <div style={styles.emptyState}>
              <FiBook size={48} />
              <p>No notes found matching current filters.</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} onClick={() => handleOpenWorkspace(note)} style={{ ...styles.noteCard, cursor: 'pointer' }}>
                <div style={styles.noteHeader}>
                  <h3 style={styles.noteTitle}>{note.title}</h3>
                  <div style={styles.noteActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleBookmark(note.id, note.is_bookmarked)}
                      style={note.is_bookmarked ? { ...styles.iconBtn, ...styles.bookmarkActive } : styles.iconBtn}
                    >
                      <FiBookmark />
                    </button>
                    <button onClick={() => handleDeleteNote(note.id)} style={styles.iconBtn}>
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                <div style={styles.noteMeta}>
                  {note.is_ai_generated && <span style={styles.aiBadge}>AI Generated</span>}
                  <span style={styles.dateBadge}>{new Date(note.updated_at).toLocaleDateString()}</span>
                  {note.current_branch_id && (
                    <span style={styles.branchIndicator}>
                      <FiGitBranch size={10} /> Branch
                    </span>
                  )}
                </div>
                <p style={styles.noteContent}>{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  // Reuse existing styles
  container: {
    padding: '2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  header: {
    marginBottom: '2.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
  },
  searchBar: {
    display: 'flex',
    gap: '1rem',
    flex: 1,
    minWidth: '300px',
    flexWrap: 'wrap',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: '200px',
  },
  searchIcon: {
    position: 'absolute',
    left: '1rem',
    color: 'var(--text-secondary)',
  },
  searchInput: {
    width: '100%',
    padding: '0.625rem 1rem 0.625rem 2.5rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  select: {
    padding: '0.625rem 1rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  filterBtn: {
    padding: '0.625rem 1rem',
    backgroundColor: 'var(--bg-card)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  filterBtnActive: {
    borderColor: 'var(--accent-primary)',
    color: 'var(--accent-primary)',
  },
  createBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '2rem',
  },
  formCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    height: 'fit-content',
  },
  sectionHeading: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-secondary)',
  },
  selectInput: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  textarea: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    minHeight: '150px',
    resize: 'vertical',
  },
  btnRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  saveBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  notesGrid: {
    gridColumn: 'span 2',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
  },
  emptyState: {
    gridColumn: '1 / -1',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    color: 'var(--text-secondary)',
  },
  noteCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    height: 'fit-content',
    transition: 'transform var(--transition-fast)',
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  noteTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    lineHeight: '1.3',
  },
  noteActions: {
    display: 'flex',
    gap: '0.25rem',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkActive: {
    color: 'var(--accent-primary)',
  },
  noteMeta: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    fontSize: '0.75rem',
  },
  aiBadge: {
    backgroundColor: 'rgba(255, 161, 22, 0.1)',
    color: 'var(--accent-primary)',
    padding: '0.125rem 0.375rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-medium)',
  },
  dateBadge: {
    color: 'var(--text-secondary)',
  },
  noteContent: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.55',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },
  branchIndicator: {
    backgroundColor: 'rgba(78, 161, 255, 0.1)',
    color: 'var(--color-info)',
    padding: '0.125rem 0.375rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-medium)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },

  // --- Extended Note Workspace Mode Styles ---
  workspaceContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - var(--navbar-height))',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  workspaceToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  workspaceMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  workspaceTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
  },
  activeBranchBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: 'var(--accent-light)',
    color: 'var(--accent-primary)',
    padding: '0.25rem 0.625rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  workspaceSecondaryBtn: {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  exportDropdownContainer: {
    position: 'relative',
    display: 'inline-block',
    '&:hover div': {
      display: 'block'
    }
  },
  dropdownContent: {
    display: 'none',
    position: 'absolute',
    right: 0,
    backgroundColor: 'var(--bg-card)',
    minWidth: '120px',
    boxShadow: 'var(--shadow-md)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
    zIndex: 10,
  },
  workspaceGridSplit: {
    display: 'grid',
    gridTemplateColumns: '1fr 450px',
    flex: 1,
    overflow: 'hidden',
  },
  editorPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    borderRight: '1px solid var(--border-primary)',
    overflowY: 'auto',
  },
  workspaceTitleInput: {
    width: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid transparent',
    color: 'var(--text-primary)',
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
    paddingBottom: '0.5rem',
    marginBottom: '1rem',
    outline: 'none',
    '&:focus': {
      borderBottom: '1px solid var(--border-primary)'
    }
  },
  workspaceContentInput: {
    width: '100%',
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9375rem',
    lineHeight: '1.6',
    resize: 'none',
    outline: 'none',
    minHeight: '200px',
  },
  quickCommitBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
    marginTop: '1.5rem',
  },
  commitInput: {
    flex: 1,
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  aiSummaryBtn: {
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.5rem',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      borderColor: 'var(--accent-primary)',
      color: 'var(--accent-primary)'
    }
  },
  checkpointLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  commitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },

  gitPanel: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-secondary)',
    overflow: 'hidden',
  },
  gitTabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
  },
  gitTab: {
    flex: 1,
    padding: '0.875rem 0.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
  },
  gitTabActive: {
    color: 'var(--accent-primary)',
    borderBottomColor: 'var(--accent-primary)',
  },
  gitTabContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
  },
  historyTab: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  gitSearchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  searchIconInside: {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--text-secondary)',
  },
  gitSearchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
  },
  timelineScroller: {
    flex: 1,
    overflowY: 'auto',
  },
  timelineFlexGrid: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  svgTimeline: {
    flexShrink: 0,
  },
  commitDetailsList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  commitCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.625rem 0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    height: '72px', // Match timeline height (80px including 8px gap)
    justifyContent: 'center',
  },
  commitCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
  },
  commitMessageText: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  commitActionsRow: {
    display: 'flex',
    gap: '0.125rem',
  },
  commitCardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  tagBadgeRow: {
    display: 'flex',
    gap: '0.25rem',
    flexWrap: 'wrap',
  },
  tagBadge: {
    backgroundColor: 'var(--accent-light)',
    color: 'var(--accent-primary)',
    padding: '0.125rem 0.375rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.6875rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  commitStatsMeta: {
    display: 'flex',
    gap: '0.5rem',
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },

  branchesTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  gitTabHeading: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.375rem',
  },
  branchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  branchItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-card)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.875rem 1rem',
  },
  branchItemActive: {
    borderColor: 'var(--accent-primary)',
  },
  branchItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  branchItemName: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
  },
  checkoutBtn: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    '&:hover': {
      borderColor: 'var(--accent-primary)',
      color: 'var(--accent-primary)'
    }
  },
  activeLabel: {
    fontSize: '0.75rem',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)',
  },

  diffTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    height: '100%',
  },
  diffSelectorRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  selectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  selectLabel: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    fontWeight: 'var(--fw-medium)',
  },
  diffSelect: {
    padding: '0.5rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    outline: 'none',
  },
  diffPlaceholder: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
  },
  diffViewerContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-primary)',
  },
  diffViewerHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    backgroundColor: 'var(--bg-card)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '0.5rem 1rem',
  },
  diffHeaderCol: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-secondary)',
  },
  diffScroller: {
    overflowY: 'auto',
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    lineHeight: '1.5',
  },
  diffRowEqual: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  diffRowAdded: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  diffRowDeleted: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  diffRowModified: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    backgroundColor: 'rgba(243, 156, 18, 0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  diffCell: {
    padding: '0.375rem 1rem',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    borderRight: '1px solid var(--border-primary)',
  },

  settingsTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  settingLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  settingSubRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    paddingLeft: '1.75rem',
  },
  subLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  settingInput: {
    width: '100px',
    padding: '0.375rem 0.75rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
  },
  saveSettingsBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    marginTop: '1rem',
  },

  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    width: '450px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
};
