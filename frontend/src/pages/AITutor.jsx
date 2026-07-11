import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiSend, FiCpu, FiMessageSquare, FiTrendingUp } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

export default function AITutor() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI learning assistant. How can I help you master your curriculum topics today?' }
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load recommendations
  useEffect(() => {
    async function loadRecommendation() {
      try {
        const res = await api.post('/ai/recommend');
        setRecommendation(res.data.recommendation);
      } catch (e) {
        // Silent fail
      }
    }
    loadRecommendation();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const res = await api.post('/ai/chat', {
        message: currentInput,
        session_id: sessionId
      });
      if (res.data.session_id) {
        setSessionId(res.data.session_id);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      toast.error('Could not reach the AI tutor service');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        .markdown-content p {
          margin-bottom: 0.75rem;
        }
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        .markdown-content ul, .markdown-content ol {
          margin-left: 1.25rem;
          margin-bottom: 0.75rem;
          list-style-type: disc;
        }
        .markdown-content ol {
          list-style-type: decimal;
        }
        .markdown-content li {
          margin-bottom: 0.25rem;
        }
        .markdown-content code {
          font-family: var(--font-mono);
          background-color: var(--bg-primary);
          padding: 0.125rem 0.25rem;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          color: var(--accent-primary);
        }
        .markdown-content pre {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-primary);
          padding: 0.75rem;
          border-radius: var(--radius-md);
          overflow-x: auto;
          margin: 0.75rem 0;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
          font-size: 0.8rem;
          color: var(--text-primary);
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .markdown-content h1 { font-size: 1.25rem; }
        .markdown-content h2 { font-size: 1.15rem; }
        .markdown-content h3 { font-size: 1.05rem; }
      `}</style>
      {/* Sidebar - Quick Prompts & Recommendations */}
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}><FiCpu /> Assistant Hub</h2>

        {recommendation && (
          <div style={styles.recommendationCard}>
            <div style={styles.recHeader}>
              <FiTrendingUp />
              <span>Recommended Next</span>
            </div>
            <p style={styles.recText}>{recommendation}</p>
          </div>
        )}

        <div style={styles.quickPromptsSection}>
          <h3 style={styles.quickPromptsTitle}>Quick Commands</h3>
          <button onClick={() => setInput('Explain time complexity of quicksort')} style={styles.quickPromptBtn}>
            Explain concept...
          </button>
          <button onClick={() => setInput('Give me hints to debug a runtime stack overflow')} style={styles.quickPromptBtn}>
            Ask debugging hint...
          </button>
          <button onClick={() => setInput('How do I optimize database joins?')} style={styles.quickPromptBtn}>
            Optimize algorithm...
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div style={styles.chatArea}>
        <div style={styles.messagesList}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={msg.role === 'user' ? styles.userRow : styles.assistantRow}
            >
              <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={styles.assistantRow}>
              <div style={{ ...styles.assistantBubble, color: 'var(--text-secondary)' }}>
                Tutor is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} style={styles.inputForm}>
          <input
            type="text"
            placeholder="Ask anything about coding, syntax, errors, or algorithm designs..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.sendBtn}>
            <FiSend size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: 'calc(100vh - var(--navbar-height))',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  recommendationCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  recHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
    textTransform: 'uppercase',
  },
  recText: {
    fontSize: '0.875rem',
    lineHeight: '1.4',
    color: 'var(--text-secondary)',
  },
  quickPromptsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  quickPromptsTitle: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-secondary)',
  },
  quickPromptBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
  },
  chatArea: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  messagesList: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  userBubble: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.875rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    maxWidth: '70%',
    fontSize: '0.875rem',
    lineHeight: '1.45',
  },
  assistantBubble: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    padding: '1rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    maxWidth: '75%',
    fontSize: '0.875rem',
    lineHeight: '1.55',
    whiteSpace: 'pre-wrap',
  },
  inputForm: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1.5rem 2rem',
    borderTop: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1.25rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  sendBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};
