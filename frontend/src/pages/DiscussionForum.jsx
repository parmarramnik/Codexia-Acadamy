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
  FiMessageCircle,
  FiX
} from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function DiscussionForum() {
  const { user } = useAuth();
  
  const [discussions, setDiscussions] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const [newReply, setNewReply] = useState('');
  
  // Doubt Creation state
  const [showAskModal, setShowAskModal] = useState(false);
  const [askForm, setAskForm] = useState({ title: '', content: '', is_doubt: false });
  
  // Messaging state
  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);

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

  // Fetch messages
  const startChat = async (targetUser) => {
    setChatUser(targetUser);
    try {
      const res = await api.get('/comms/messages', {
        params: { with_user_id: targetUser.id }
      });
      const now = Date.now();
      const loadedMsgs = (res.data || []).map((m, idx) => ({
        ...m,
        id: m.id || `msg-${now}-${idx}-${Math.random()}`,
        visibleUntil: now + 4000
      }));
      setMessages(loadedMsgs);
    } catch (err) {
      toast.error('Could not load chat logs');
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setIsSendingMsg(true);
    try {
      await api.post('/comms/messages', null, {
        params: {
          receiver_id: chatUser.id,
          message: newMsg
        }
      });
      const now = Date.now();
      const sentMsg = {
        sender_id: 'me',
        message: newMsg,
        created_at: new Date().toISOString(),
        id: `msg-sent-${now}-${Math.random()}`,
        visibleUntil: now + 4000
      };
      setMessages(prev => [...prev, sentMsg]);
      setNewMsg('');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Automatically vanish direct messages after 4 seconds of display
  useEffect(() => {
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        const filtered = prev.filter(m => !m.visibleUntil || m.visibleUntil > now);
        if (filtered.length !== prev.length) {
          return filtered;
        }
        return prev;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [messages]);

  // Dynamic process description in the upper left header
  const getDynamicSubtitle = () => {
    if (!user) return 'Ask doubts, participate in group discussions, or message classmates directly.';
    
    const roleName = user.role === 'student' ? 'Student' : 
                     user.role === 'instructor' ? 'Instructor' : 'Administrator';
    const name = user.full_name || user.username || 'User';

    if (chatUser) {
      return `${roleName} ${name} is direct messaging with ${chatUser.full_name}.`;
    }
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

    return `${roleName} ${name} is active in the Collaboration Hub. Ask doubts, participate in discussions, or direct message peers.`;
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
          <h3 style={styles.sidebarTitle}>
            <FiMessageSquare style={{ marginRight: '6px' }} /> Discussion Threads
          </h3>
          {isLoading ? (
            <p style={styles.loadingText}>Loading threads...</p>
          ) : discussions.length === 0 ? (
            <p style={styles.loadingText}>No discussions yet. Be the first to start a thread!</p>
          ) : (
            <div style={styles.list}>
              {discussions.map(t => (
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
                    {t.is_resolved ? (
                      <span style={styles.resolvedBadge}>
                        <FiCheckCircle size={12} /> Resolved
                      </span>
                    ) : t.is_doubt ? (
                      <button onClick={(e) => { e.stopPropagation(); handleResolveDoubt(t.id); }} style={styles.resolveBtn}>
                        Resolve
                      </button>
                    ) : null}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FiUser style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{selectedThread.user.full_name}</span>
                  </div>
                  <button onClick={() => startChat(selectedThread.user)} style={styles.dmBtn} title="Start direct message">
                    <FiMessageCircle size={14} style={{ marginRight: '4px' }} /> Chat
                  </button>
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

      {/* Direct Messaging Drawer Overlay */}
      {chatUser && (
        <div style={styles.chatDrawer}>
          <div style={styles.chatHeader}>
            <span style={{ fontWeight: '600' }}>Chatting with {chatUser.full_name}</span>
            <button onClick={() => setChatUser(null)} style={styles.closeChatBtn}>
              <FiX size={18} />
            </button>
          </div>
          <div style={styles.chatBody}>
            {messages.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                No messages yet. Send a direct message to start chatting!
              </p>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.sender_id === 'me' || m.sender_id === 1; // dummy validation
                return (
                  <div key={m.id || idx} style={{
                    ...styles.chatBubble,
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    backgroundColor: isMe ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isMe ? 'var(--text-inverse)' : 'var(--text-primary)',
                    border: isMe ? 'none' : '1px solid var(--border-primary)'
                  }}>
                    {m.message}
                  </div>
                );
              })
            )}
          </div>
          <form onSubmit={handleSendMessage} style={styles.chatForm}>
            <input 
              type="text" 
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Send message..."
              style={styles.chatInput}
            />
            <LoadingButton type="submit" loading={isSendingMsg} loadingText="" style={styles.chatSendBtn}><FiSend /></LoadingButton>
          </form>
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
  },
  chatDrawer: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '340px',
    height: '460px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1010,
    overflow: 'hidden'
  },
  chatHeader: {
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.9rem 1.2rem',
    borderBottom: '1px solid var(--border-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    color: 'var(--text-primary)'
  },
  closeChatBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'color var(--transition-fast)'
  },
  chatBody: {
    flex: 1,
    padding: '1.2rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    backgroundColor: 'rgba(0, 0, 0, 0.05)'
  },
  chatBubble: {
    padding: '0.6rem 0.9rem',
    borderRadius: '12px',
    fontSize: '0.85rem',
    maxWidth: '75%',
    lineHeight: '1.4',
    wordBreak: 'break-word'
  },
  chatForm: {
    display: 'flex',
    padding: '0.85rem 1rem',
    borderTop: '1px solid var(--border-primary)',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-card)'
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: '0.55rem 0.85rem',
    fontSize: '0.85rem',
    outline: 'none',
    transition: 'border-color var(--transition-fast)'
  },
  chatSendBtn: {
    padding: '0 0.85rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)'
  }
};
