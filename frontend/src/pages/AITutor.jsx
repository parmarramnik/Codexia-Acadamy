import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiSend, FiCpu, FiMessageSquare, FiTrendingUp, FiMic, FiMicOff, FiTrash2, FiCopy, FiCode } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

export default function AITutor() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI learning assistant. How can I help you master your curriculum topics today?' }
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [isListening, setIsListening] = useState(false);

  // Canvas State
  const [activeCanvasCode, setActiveCanvasCode] = useState(null);
  const [activeCanvasLanguage, setActiveCanvasLanguage] = useState('');
  const [activeCanvasTitle, setActiveCanvasTitle] = useState('');
  
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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

  // Web Speech recognition integration with robust error diagnostic
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech Recognition is not supported by your browser. Please use Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      toast('Listening... Speak clearly.', { icon: '🎙️' });
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
      setIsListening(false);
      toast.success('Speech captured!');
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      console.error('[Speech Recognition Error]', event);
      if (event.error === 'not-allowed') {
        toast.error('Microphone blocked. Please click the mic lock in your address bar and allow permission.');
      } else if (event.error === 'no-speech') {
        toast.error('No speech detected. Please speak closer to your microphone.');
      } else if (event.error === 'aborted') {
        toast.error('Speech recognition session ended.');
      } else {
        toast.error(`Mic Error: ${event.error || 'check audio settings'}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

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

  const handleResetChat = () => {
    setSessionId(null);
    setMessages([
      { role: 'assistant', content: 'Session context has been reset! Ask me a new concept or topic.' }
    ]);
    setActiveCanvasCode(null);
    toast.success('Chat memory cleared.');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied content to clipboard');
  };

  return (
    <div style={styles.container}>
      <style>{`
        .markdown-content {
          line-height: 1.6;
          font-family: inherit;
          color: var(--text-primary);
        }
        .markdown-content p {
          margin-bottom: 1rem;
        }
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        .markdown-content ul, .markdown-content ol {
          margin-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .markdown-content ul {
          list-style-type: disc;
        }
        .markdown-content ol {
          list-style-type: decimal;
        }
        .markdown-content li {
          margin-bottom: 0.4rem;
        }
        .markdown-content code {
          font-family: Consolas, Monaco, monospace;
          background-color: rgba(255, 255, 255, 0.08);
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: var(--accent-primary);
        }
        .markdown-content pre {
          background-color: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-primary);
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1.25rem 0;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
          font-size: 0.8rem;
          color: #E2E8F0;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          font-weight: var(--fw-semibold);
          color: var(--accent-primary);
        }
        .markdown-content h1 { font-size: 1.3rem; border-bottom: 1px solid var(--border-primary); padding-bottom: 0.25rem; }
        .markdown-content h2 { font-size: 1.15rem; }
        .markdown-content h3 { font-size: 1.05rem; }
        .markdown-content blockquote {
          border-left: 4px solid var(--accent-primary);
          background-color: rgba(255, 255, 255, 0.02);
          margin: 1rem 0;
          padding: 0.5rem 1rem;
          border-radius: 0 4px 4px 0;
          color: var(--text-secondary);
        }
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.25rem 0;
          font-size: 0.85rem;
        }
        .markdown-content th, .markdown-content td {
          border: 1px solid var(--border-primary);
          padding: 0.6rem 0.8rem;
          text-align: left;
        }
        .markdown-content th {
          background-color: rgba(255, 255, 255, 0.04);
          font-weight: var(--fw-medium);
        }
        .markdown-content tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.01);
        }
        .dots-loader {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .dot {
          width: 6px;
          height: 6px;
          background-color: var(--text-secondary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
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

        <button onClick={handleResetChat} style={styles.resetBtn}>
          <FiTrash2 /> Clear Session Context
        </button>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.2rem' }}>
                  <strong style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {msg.role === 'user' ? 'You' : 'AI Tutor'}
                  </strong>
                  <button onClick={() => copyToClipboard(msg.content)} style={styles.copyBtn} title="Copy to clipboard">
                    <FiCopy size={12} />
                  </button>
                </div>
                {msg.role === 'user' ? (
                  <span style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : (
                  <div className="markdown-content" style={{ fontSize: '0.875rem' }}>
                    <ReactMarkdown
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          if (!inline && match) {
                            return (
                              <div style={styles.codeWrapper}>
                                <div style={styles.codeHeader}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{match[1].toUpperCase()}</span>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      setActiveCanvasCode(codeString);
                                      setActiveCanvasLanguage(match[1]);
                                      setActiveCanvasTitle("Code Workspace");
                                    }}
                                    style={styles.openCanvasBtn}
                                  >
                                    <FiCode size={12} /> Open in Canvas ↗
                                  </button>
                                </div>
                                <pre style={{ margin: 0, borderRadius: '0 0 6px 6px' }}>
                                  <code className={className} {...props}>{children}</code>
                                </pre>
                              </div>
                            );
                          }
                          return <code className={className} {...props}>{children}</code>;
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div style={styles.assistantRow}>
              <div style={styles.assistantBubble}>
                <div className="dots-loader">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '6px' }}>Thinking</span>
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} style={styles.inputForm}>
          <button 
            type="button" 
            onClick={startSpeechRecognition} 
            style={{ ...styles.speechBtn, backgroundColor: isListening ? 'var(--color-error)' : 'var(--bg-primary)' }}
            title="Dictate message"
          >
            {isListening ? <FiMicOff /> : <FiMic />}
          </button>
          <input
            type="text"
            placeholder="Ask anything about coding, syntax, errors, or algorithm designs..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.sendBtn} aria-label="Send message">
            <FiSend size={16} />
          </button>
        </form>
      </div>

      {/* Side Canvas Workspace Panel */}
      {activeCanvasCode !== null && (
        <div style={styles.canvasPanel}>
          <div style={styles.canvasHeader}>
            <div>
              <h3 style={styles.canvasTitle}>{activeCanvasTitle}</h3>
              <span style={styles.canvasSubtitle}>Live Interactive Editor ({activeCanvasLanguage.toUpperCase()})</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => copyToClipboard(activeCanvasCode)} style={styles.canvasActionBtn}>
                <FiCopy /> Copy
              </button>
              <button onClick={() => setActiveCanvasCode(null)} style={styles.canvasCloseBtn}>
                Close
              </button>
            </div>
          </div>
          <div style={styles.canvasBody}>
            <textarea
              value={activeCanvasCode}
              onChange={(e) => setActiveCanvasCode(e.target.value)}
              style={styles.canvasTextarea}
              spellCheck="false"
            />
          </div>
        </div>
      )}
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
  resetBtn: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
    color: 'var(--color-error)',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold'
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
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  speechBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    flexShrink: 0
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
    border: 'none'
  },

  // Code wrapper header block in message stream
  codeWrapper: {
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    margin: '1rem 0',
    overflow: 'hidden'
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '0.5rem 1rem'
  },
  openCanvasBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },

  // Side Canvas Panel Styles
  canvasPanel: {
    width: '45%',
    borderLeft: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    animation: 'slideIn 0.3s ease-out'
  },
  canvasHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)'
  },
  canvasTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)'
  },
  canvasSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  canvasActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  canvasCloseBtn: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    border: 'none',
    borderRadius: '4px',
    color: 'var(--color-error)',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  canvasBody: {
    flex: 1,
    padding: '1.5rem',
    backgroundColor: '#0F0F13'
  },
  canvasTextarea: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#D4D4D4',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    resize: 'none'
  }
};
