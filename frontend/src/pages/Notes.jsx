import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiBook, FiPlus, FiTrash2, FiBookmark, FiSearch, FiCheck } from 'react-icons/fi';

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

    try {
      await api.post('/notes', {
        title: newNote.title,
        content: newNote.content,
        course_id: newNote.course_id ? parseInt(newNote.course_id) : null
      });
      toast.success('Note saved successfully!');
      setShowCreate(false);
      setNewNote({ title: '', content: '', course_id: courses[0]?.id || '' });
      loadData();
    } catch (err) {
      toast.error('Failed to save note');
    }
  };

  const handleToggleBookmark = async (noteId, currentStatus) => {
    try {
      await api.put(`/notes/${noteId}`, {
        is_bookmarked: !currentStatus
      });
      toast.success(!currentStatus ? 'Bookmarked' : 'Bookmark removed');
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
      loadData();
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  if (isLoading && notes.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading notebook index...</p>
      </div>
    );
  }

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
              <button type="submit" style={styles.saveBtn}>Save Note</button>
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
              <div key={note.id} style={styles.noteCard}>
                <div style={styles.noteHeader}>
                  <h3 style={styles.noteTitle}>{note.title}</h3>
                  <div style={styles.noteActions}>
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
    border: '1px solid var(--border-primary)',
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
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
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
  },
};
