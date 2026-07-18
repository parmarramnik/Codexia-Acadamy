import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiMessageSquare, 
  FiHelpCircle, 
  FiCheckCircle, 
  FiSend, 
  FiUser, 
  FiMessageCircle,
  FiBell
} from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function DiscussionForum() {
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
  const startChat = async (user) => {
    setChatUser(user);
    try {
      const res = await api.get('/comms/messages', {
        params: { with_user_id: user.id }
      });
      setMessages(res.data || []);
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
      const sentMsg = {
        sender_id: 'me',
        message: newMsg,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, sentMsg]);
      setNewMsg('');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setIsSendingMsg(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Collaboration Hub</h1>
          <p style={styles.subtitle}>Ask doubts, participate in group discussions, or message classmates directly.</p>
        </div>
        <button onClick={() => setShowAskModal(true)} style={styles.askBtn}>
          Ask a Doubt
        </button>
      </div>

      <div style={styles.grid}>
        {/* Left Side: Threads List */}
        <div style={styles.threadsBox}>
          <h3 style={styles.sidebarTitle}><FiMessageSquare /> Discussion Threads</h3>
          {isLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading threads...</p>
          ) : discussions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No discussions yet. Be the first to start a thread!</p>
          ) : (
            <div style={styles.list}>
              {discussions.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => selectThread(t.id)}
                  style={{
                    ...styles.threadItem,
                    borderColor: selectedThread?.id === t.id ? 'var(--accent-primary)' : 'var(--border-primary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={styles.threadTitle}>
                      {t.is_doubt && <FiHelpCircle style={{ color: 'var(--color-warning)', marginRight: '4px' }} />}
                      {t.title}
                    </span>
                    {t.is_resolved ? (
                      <span style={{ color: 'var(--color-success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <FiCheckCircle /> Resolved
                      </span>
                    ) : t.is_doubt ? (
                      <button onClick={(e) => { e.stopPropagation(); handleResolveDoubt(t.id); }} style={styles.resolveBtn}>
                        Resolve
                      </button>
                    ) : null}
                  </div>
                  <p style={styles.threadPreview}>{t.content.slice(0, 100)}...</p>
                  <div style={styles.threadMeta}>
                    <span>By {t.user.full_name}</span>
                    <span>{t.replies_count} replies</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Middle: Selected Thread Details */}
        <div style={styles.detailsBox}>
          {selectedThread ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={styles.threadMainHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <FiUser style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontWeight: 'bold' }}>{selectedThread.user.full_name}</span>
                  <button onClick={() => startChat(selectedThread.user)} style={styles.dmBtn} title="Start direct message">
                    <FiMessageCircle size={14} /> Chat
                  </button>
                </div>
                <h2 style={styles.mainTitle}>{selectedThread.title}</h2>
                <p style={styles.mainContent}>{selectedThread.content}</p>
              </div>

              {/* Replies Container */}
              <div style={styles.repliesSection}>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.25rem' }}>Replies</h4>
                <div style={styles.repliesList}>
                  {threadReplies.map(r => (
                    <div key={r.id} style={styles.replyCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={styles.replyAuthor}>{r.user.full_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={styles.replyText}>{r.content}</p>
                    </div>
                  ))}
                </div>
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
                <LoadingButton type="submit" loading={isReplying} loadingText="" style={styles.sendBtn}><FiSend /></LoadingButton>
              </form>
            </div>
          ) : (
            <div style={styles.emptyDetails}>
              <FiMessageSquare size={48} style={{ color: 'var(--text-secondary)' }} />
              <p>Select a discussion thread to view replies, or click Ask Doubt to launch a new Q&A thread.</p>
            </div>
          )}
        </div>
      </div>

      {/* Ask Doubt Modal */}
      {showAskModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Ask a Doubt / Start Discussion</h3>
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
                style={{ ...styles.modalInput, height: '120px', resize: 'none' }}
                required
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input 
                  type="checkbox" 
                  id="is_doubt" 
                  checked={askForm.is_doubt}
                  onChange={(e) => setAskForm({...askForm, is_doubt: e.target.checked})}
                />
                <label htmlFor="is_doubt">Mark as Doubt (Requires resolving flag)</label>
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
            <span>Chatting with {chatUser.full_name}</span>
            <button onClick={() => setChatUser(null)} style={styles.closeChatBtn}>×</button>
          </div>
          <div style={styles.chatBody}>
            {messages.map((m, idx) => {
              const isMe = m.sender_id === 'me' || m.sender_id === 1; // dummy validation
              return (
                <div key={m.id || idx} style={{
                  ...styles.chatBubble,
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  backgroundColor: isMe ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'
                }}>
                  {m.message}
                </div>
              );
            })}
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
    height: 'calc(100vh - 120px)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexShrink: 0
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem'
  },
  askBtn: {
    padding: '0.6rem 1.2rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 'var(--fw-semibold)'
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
    fontSize: '1.1rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
    flexShrink: 0
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    overflowY: 'auto',
    flex: 1
  },
  threadItem: {
    padding: '1rem',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'border-color 0.2s'
  },
  threadTitle: {
    fontWeight: 'var(--fw-semibold)',
    fontSize: '0.95rem',
    display: 'flex',
    alignItems: 'center'
  },
  resolveBtn: {
    padding: '0.2rem 0.5rem',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    color: 'var(--color-success)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem'
  },
  threadPreview: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    margin: '0.5rem 0'
  },
  threadMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
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
    marginBottom: '1rem',
    flexShrink: 0
  },
  mainTitle: {
    fontSize: '1.4rem',
    fontWeight: 'var(--fw-semibold)',
    margin: '0.5rem 0'
  },
  mainContent: {
    fontSize: '0.9rem',
    lineHeight: '1.5'
  },
  dmBtn: {
    padding: '0.2rem 0.5rem',
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    marginLeft: '0.75rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px'
  },
  repliesSection: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '1rem'
  },
  repliesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  replyCard: {
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)'
  },
  replyAuthor: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--accent-primary)'
  },
  replyText: {
    fontSize: '0.85rem',
    margin: '0.25rem 0 0 0',
    lineHeight: '1.4'
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
    padding: '0.75rem',
    outline: 'none',
    fontSize: '0.875rem'
  },
  sendBtn: {
    padding: '0 1rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer'
  },
  emptyDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    gap: '0.75rem',
    textAlign: 'center',
    padding: '0 2rem'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    width: '450px'
  },
  modalInput: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.75rem',
    outline: 'none',
    marginBottom: '1rem',
    fontSize: '0.875rem'
  },
  cancelBtn: {
    padding: '0.6rem 1.2rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  chatDrawer: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '320px',
    height: '420px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1010
  },
  chatHeader: {
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold',
    fontSize: '0.9rem'
  },
  closeChatBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '1.25rem',
    cursor: 'pointer'
  },
  chatBody: {
    flex: 1,
    padding: '1rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  chatBubble: {
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    maxWidth: '80%'
  },
  chatForm: {
    display: 'flex',
    padding: '0.75rem',
    borderTop: '1px solid var(--border-primary)',
    gap: '0.4rem'
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '0.5rem',
    fontSize: '0.8rem',
    outline: 'none'
  },
  chatSendBtn: {
    padding: '0 0.75rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};
