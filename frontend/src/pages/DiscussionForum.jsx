import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiMessageSquare, 
  FiHelpCircle, 
  FiCheckCircle, 
  FiSend, 
  FiUser, 
  FiX,
  FiTrash2,
  FiSearch
} from 'react-icons/fi';

import LoadingButton from '../components/common/LoadingButton';

export default function DiscussionForum() {
  const { user } = useAuth();
  
  const [discussions, setDiscussions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const [newReply, setNewReply] = useState('');

  
  // Doubt Creation state
  const [showAskModal, setShowAskModal] = useState(false);
  const [askForm, setAskForm] = useState({ title: '', content: '', is_doubt: false });
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  // Load threads
  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/comms/discussions');
      setDiscussions(res.data || []);
    } catch (err) {
      toast.error('Failed to load discussions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  // Fetch thread details
  const selectThread = async (id) => {
    try {
      const res = await api.get(`/comms/discussions/${id}`);
      setSelectedThread(res.data);
      setThreadReplies(res.data.replies || []);
    } catch (err) {
      toast.error('Failed to load thread replies');
    }
  };

  // Submit reply
  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!newReply.trim()) return;
    setIsReplying(true);
    try {
      await api.post(`/comms/discussions/${selectedThread.id}/replies`, {
        content: newReply
      });
      toast.success('Reply posted!');
      setNewReply('');
      selectThread(selectedThread.id);
    } catch (err) {
      toast.error('Failed to post reply');
    } finally {
      setIsReplying(false);
    }
  };

  // Resolve doubt
  const handleResolveDoubt = async (id) => {
    try {
      await api.patch(`/comms/discussions/${id}/resolve`);
      toast.success('Thread marked as resolved!');
      if (selectedThread?.id === id) {
        setSelectedThread(prev => ({ ...prev, is_resolved: true }));
      }
      loadThreads();
    } catch (err) {
      toast.error('Could not mark resolved');
    }
  };

  // Delete thread / doubt
  const handleDeleteThread = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this thread/doubt?')) return;
    try {
      await api.delete(`/comms/discussions/${id}`);
      toast.success('Thread removed successfully');
      if (selectedThread?.id === id) {
        setSelectedThread(null);
      }
      loadThreads();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove thread');
    }
  };

  // Submit new thread
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!askForm.title.trim() || !askForm.content.trim()) return;
    setIsAsking(true);
    try {
      await api.post('/comms/discussions', null, {
        params: {
          title: askForm.title,
          content: askForm.content,
          is_doubt: askForm.is_doubt
        }
      });
      toast.success('Discussion thread created!');
      setShowAskModal(false);
      setAskForm({ title: '', content: '', is_doubt: false });
      loadThreads();
    } catch (err) {
      toast.error('Failed to create thread');
    } finally {
      setIsAsking(false);
    }
  };

  // Dynamic process description in the upper left header
  const getDynamicSubtitle = () => {
    if (!user) return 'Ask doubts, share solutions, and participate in technical peer discussions.';
    
    const roleName = user.role === 'student' ? 'Student' : 
                     user.role === 'instructor' ? 'Instructor' : 'Administrator';
    const name = user.full_name || user.username || 'User';

    if (showAskModal) {
      return `${roleName} ${name} is writing a new doubt / question.`;
    }
    if (selectedThread) {
      const authorName = selectedThread.user?.full_name || 'someone';
      if (selectedThread.is_doubt) {
        if (selectedThread.is_resolved) {
          return `${roleName} ${name} is viewing a resolved doubt by ${authorName}.`;
        }
        return `${roleName} ${name} is reviewing an open doubt by ${authorName}.`;
      }
      return `${roleName} ${name} is participating in a discussion started by ${authorName}.`;
    }

    return `${roleName} ${name} is active in the Collaboration Hub. Ask doubts, share solutions, and participate in discussions.`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Collaboration Hub</h1>
          <p style={styles.subtitle}>{getDynamicSubtitle()}</p>
        </div>
        <button onClick={() => setShowAskModal(true)} style={styles.askBtn}>
          Ask a Doubt
        </button>
      </div>

      <div style={styles.grid}>
        {/* Left Side: Threads List */}
        <div style={styles.threadsBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ ...styles.sidebarTitle, margin: 0 }}>
              <FiMessageSquare style={{ marginRight: '6px' }} /> Discussions
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {discussions.filter(t => {
                if (filterType === 'doubts' && !t.is_doubt) return false;
                if (filterType === 'discussions' && t.is_doubt) return false;
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (t.title || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q);
              }).length} threads
            </span>
          </div>

          {/* Contextual Forum Search */}
          <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
            <FiSearch size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search discussions & doubts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 28px 7px 30px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '2px'
                }}
              >✕</button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {['all', 'doubts', 'discussions'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: filterType === f ? 'var(--accent-primary)' : 'var(--border-primary)',
                  backgroundColor: filterType === f ? 'rgba(255, 161, 22, 0.12)' : 'transparent',
                  color: filterType === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: filterType === f ? 600 : 400,
                  textTransform: 'capitalize'
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p style={styles.loadingText}>Loading threads...</p>
          ) : discussions.length === 0 ? (
            <p style={styles.loadingText}>No discussions yet. Be the first to start a thread!</p>
          ) : (
            <div style={styles.list}>
              {discussions
                .filter(t => {
                  if (filterType === 'doubts' && !t.is_doubt) return false;
                  if (filterType === 'discussions' && t.is_doubt) return false;
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (t.title || '').toLowerCase().includes(q) || (t.content || '').toLowerCase().includes(q);
                })
                .map(t => (
                <div 
                  key={t.id} 
                  onClick={() => selectThread(t.id)}
                  style={{
                    ...styles.threadItem,
                    borderColor: selectedThread?.id === t.id ? 'var(--accent-primary)' : 'var(--border-primary)',
                    backgroundColor: selectedThread?.id === t.id ? 'rgba(255, 161, 22, 0.04)' : 'rgba(255, 255, 255, 0.01)'
                  }}
                >

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      ...styles.threadTitle,
                      color: selectedThread?.id === t.id ? 'var(--accent-primary)' : 'var(--text-primary)'
                    }}>
                      {t.is_doubt && <FiHelpCircle style={{ color: 'var(--color-warning)', marginRight: '4px', flexShrink: 0 }} />}
                      {t.title}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {t.is_resolved ? (
                        <span style={styles.resolvedBadge}>
                          <FiCheckCircle size={12} /> Resolved
                        </span>
                      ) : t.is_doubt ? (
                        <button onClick={(e) => { e.stopPropagation(); handleResolveDoubt(t.id); }} style={styles.resolveBtn}>
                          Resolve
                        </button>
                      ) : null}

                      {(user?.id === t.user?.id || ['admin', 'super_admin', 'instructor'].includes(user?.role)) && (
                        <button
                          onClick={(e) => handleDeleteThread(t.id, e)}
                          style={{
                            background: 'rgba(244, 67, 54, 0.1)',
                            border: '1px solid rgba(244, 67, 54, 0.3)',
                            color: '#F44336',
                            borderRadius: '4px',
                            padding: '3px 7px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.75rem',
                          }}
                          title="Delete this thread/doubt"
                        >
                          <FiTrash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={styles.threadPreview}>{t.content.length > 80 ? `${t.content.slice(0, 80)}...` : t.content}</p>
                  <div style={styles.threadMeta}>
                    <span>By {t.user.full_name}</span>
                    <span>{t.replies_count} {t.replies_count === 1 ? 'reply' : 'replies'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Selected Thread Details */}
        <div style={styles.detailsBox}>
          {selectedThread ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={styles.threadMainHeader}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FiUser style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{selectedThread.user.full_name}</span>
                  </div>
                </div>
                <h2 style={styles.mainTitle}>{selectedThread.title}</h2>
                <p style={styles.mainContent}>{selectedThread.content}</p>
              </div>

              {/* Replies Container */}
              <div style={styles.repliesSection}>
                <h4 style={styles.sectionHeading}>Replies</h4>
                {threadReplies.length === 0 ? (
                  <p style={styles.noRepliesText}>No replies yet. Start the conversation!</p>
                ) : (
                  <div style={styles.repliesList}>
                    {threadReplies.map(r => (
                      <div key={r.id} style={styles.replyCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                          <span style={styles.replyAuthor}>{r.user.full_name}</span>
                          <span style={styles.replyDate}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p style={styles.replyText}>{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Form */}
              <form onSubmit={handlePostReply} style={styles.replyForm}>
                <input 
                  type="text" 
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder="Post a reply or solution..."
                  style={styles.replyInput}
                />
                <LoadingButton type="submit" loading={isReplying} loadingText="" style={styles.sendBtn}>
                  <FiSend size={16} />
                </LoadingButton>
              </form>
            </div>
          ) : (
            <div style={styles.emptyDetails}>
              <FiMessageSquare size={48} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>No Thread Selected</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Select a discussion thread from the left sidebar to view replies, or click Ask Doubt to launch a new Q&A.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ask Doubt Modal */}
      {showAskModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalHeader}>Ask a Doubt / Start Discussion</h3>
            <form onSubmit={handleAskQuestion}>
              <input 
                type="text" 
                placeholder="Title (e.g. How to balance binary tree?)" 
                value={askForm.title}
                onChange={(e) => setAskForm({...askForm, title: e.target.value})}
                style={styles.modalInput}
                required
              />
              <textarea 
                placeholder="Describe your issue or conceptual question in detail..." 
                value={askForm.content}
                onChange={(e) => setAskForm({...askForm, content: e.target.value})}
                style={{ ...styles.modalInput, height: '140px', resize: 'none' }}
                required
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input 
                  type="checkbox" 
                  id="is_doubt" 
                  checked={askForm.is_doubt}
                  onChange={(e) => setAskForm({...askForm, is_doubt: e.target.checked})}
                  style={styles.checkbox}
                />
                <label htmlFor="is_doubt" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Mark as Doubt (Requires resolving flag)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAskModal(false)} style={styles.cancelBtn}>Cancel</button>
                <LoadingButton type="submit" loading={isAsking} loadingText="Submitting..." style={styles.askBtn}>Submit Thread</LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 100px)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexShrink: 0
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.4rem',
    color: 'var(--text-primary)'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    margin: 0
  },
  askBtn: {
    padding: '0.65rem 1.25rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 'var(--fw-semibold)',
    fontSize: '0.875rem',
    transition: 'background-color var(--transition-fast)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 2fr',
    gap: '2rem',
    flex: 1,
    minHeight: 0
  },
  threadsBox: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  sidebarTitle: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1.2rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
    flexShrink: 0,
    color: 'var(--text-primary)'
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    margin: '1rem 0'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    overflowY: 'auto',
    flex: 1,
    paddingRight: '4px'
  },
  threadItem: {
    padding: '1rem',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  threadTitle: {
    fontWeight: 'var(--fw-medium)',
    fontSize: '0.925rem',
    display: 'flex',
    alignItems: 'center',
    lineHeight: '1.4',
    wordBreak: 'break-word'
  },
  resolveBtn: {
    padding: '0.25rem 0.6rem',
    backgroundColor: 'transparent',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    flexShrink: 0,
    transition: 'all 0.15s ease'
  },
  resolvedBadge: {
    color: 'var(--color-success)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0
  },
  threadPreview: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.4',
    wordBreak: 'break-word'
  },
  threadMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '0.25rem'
  },
  detailsBox: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  threadMainHeader: {
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '1.25rem',
    marginBottom: '1.25rem',
    flexShrink: 0
  },
  mainTitle: {
    fontSize: '1.35rem',
    fontWeight: 'var(--fw-semibold)',
    margin: '0.75rem 0',
    color: 'var(--text-primary)',
    lineHeight: '1.4'
  },
  mainContent: {
    fontSize: '0.9rem',
    lineHeight: '1.5',
    color: 'var(--text-secondary)',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  dmBtn: {
    padding: '0.3rem 0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 'var(--fw-medium)',
    transition: 'all 0.15s ease'
  },
  repliesSection: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '1.25rem',
    paddingRight: '4px'
  },
  sectionHeading: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '1rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
    color: 'var(--text-primary)'
  },
  noRepliesText: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textAlign: 'center',
    margin: '2rem 0'
  },
  repliesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  replyCard: {
    padding: '0.85rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)'
  },
  replyAuthor: {
    fontSize: '0.825rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--accent-primary)'
  },
  replyDate: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  replyText: {
    fontSize: '0.85rem',
    margin: '0.4rem 0 0 0',
    lineHeight: '1.45',
    color: 'var(--text-primary)',
    wordBreak: 'break-word'
  },
  replyForm: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.75rem 1rem',
    outline: 'none',
    fontSize: '0.875rem',
    transition: 'border-color var(--transition-fast)'
  },
  sendBtn: {
    padding: '0 1.25rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)'
  },
  emptyDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    gap: '0.5rem',
    textAlign: 'center',
    padding: '0 2rem'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    width: '100%',
    maxWidth: '480px',
    boxShadow: 'var(--shadow-xl)'
  },
  modalHeader: {
    fontSize: '1.2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '1.25rem',
    color: 'var(--text-primary)'
  },
  modalInput: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: '0.75rem 1rem',
    outline: 'none',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    transition: 'border-color var(--transition-fast)'
  },
  checkbox: {
    accentColor: 'var(--accent-primary)',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '0.6rem 1.2rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    transition: 'all 0.15s ease'
  }
};
