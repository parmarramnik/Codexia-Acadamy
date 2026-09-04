import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import LoadingButton from '../components/common/LoadingButton';
import { 
  FiCpu, 
  FiMessageSquare, 
  FiSend, 
  FiTrash2, 
  FiCopy, 
  FiMic, 
  FiMicOff, 
  FiCode, 
  FiClock, 
  FiBookOpen,
  FiTerminal,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';

export default function EnterpriseAI() {
  const [activeTab, setActiveTab] = useState('tutor'); // 'tutor' | 'debugger'
  
  // Real Database Courses
  const [courses, setCourses] = useState([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);

  // AI Tutor state
  const [tutorSession, setTutorSession] = useState(() => `tutor_${Date.now()}`);
  const [tutorMsg, setTutorMsg] = useState('');
  const [tutorChat, setTutorChat] = useState([
    { 
      role: 'assistant', 
      content: 'Hello! I am your AI Study Assistant at Codexia Academy. Ask me any conceptual programming questions, algorithm explanations, or code debugging challenges!' 
    }
  ]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  // Code Debugger state
  const [debugCode, setDebugCode] = useState('def binary_search(arr, target):\n    low = 0\n    high = len(arr) # bug: off by one\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1');
  const [debugLang, setDebugLang] = useState('python');
  const [debugError, setDebugError] = useState('IndexError: list index out of range when target is not in array');
  const [debugResult, setDebugResult] = useState(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);

  // Canvas State
  const [activeCanvasCode, setActiveCanvasCode] = useState(null);
  const [activeCanvasLanguage, setActiveCanvasLanguage] = useState('');
  const [activeCanvasTitle, setActiveCanvasTitle] = useState('');

  // Auto-scroll refs
  const tutorEndRef = useRef(null);
  useEffect(() => {
    tutorEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorChat, isTutorLoading]);

  // Fetch real courses from database on mount
  useEffect(() => {
    async function fetchPlatformCourses() {
      try {
        const res = await api.get('/courses');
        const items = res.data?.items || res.data || [];
        setCourses(items.slice(0, 5));
      } catch (err) {
        console.error('Failed to load courses for AI Assistant:', err);
      } finally {
        setIsCoursesLoading(false);
      }
    }
    fetchPlatformCourses();
  }, []);

  // Speech Recognition Handler
  const startSpeechRecognition = (setInputVal) => {
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
      setInputVal(prev => prev ? prev + ' ' + transcript : transcript);
      setIsListening(false);
      toast.success('Speech captured!');
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      console.error('[Speech Recognition Error]', event);
      if (event.error === 'not-allowed') {
        toast.error('Microphone blocked. Please allow microphone access in your browser address bar.');
      } else if (event.error === 'no-speech') {
        toast.error('No speech detected. Please speak closer to your mic.');
      } else if (event.error === 'aborted') {
        toast.error('Speech recognition cancelled.');
      } else {
        toast.error(`Mic Error: ${event.error || 'check audio settings'}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Structured Content Formatter with Code Canvas trigger
  const renderFormattedContent = (text) => {
    return (
      <div className="markdown-content">
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
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          type="button" 
                          onClick={() => copyToClipboard(codeString)}
                          style={styles.codeHeaderBtn}
                          title="Copy Code"
                        >
                          <FiCopy size={12} /> Copy
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            setActiveCanvasCode(codeString);
                            setActiveCanvasLanguage(match[1]);
                            setActiveCanvasTitle("Code Canvas");
                          }}
                          style={styles.openCanvasBtn}
                          title="Open in Code Canvas"
                        >
                          <FiCode size={12} /> Open in Canvas ↗
                        </button>
                      </div>
                    </div>
                    <pre style={{ margin: 0, borderRadius: '0 0 6px 6px', background: '#0B0F17', padding: '0.85rem' }}>
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  </div>
                );
              }
              return <code className={className} {...props}>{children}</code>;
            }
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  };

  // Clear Tutor Chat History
  const handleClearTutorChat = () => {
    setTutorSession(`tutor_${Date.now()}`);
    setTutorChat([
      { role: 'assistant', content: "Conversation reset! Let's start a new conceptual or debugging lesson." }
    ]);
    setActiveCanvasCode(null);
    toast.success('Session memory reset.');
  };

  // Send message to AI Tutor
  const handleTutorSend = async (customMsg = null) => {
    const messageToSend = typeof customMsg === 'string' ? customMsg : tutorMsg;
    if (!messageToSend.trim()) return;

    setTutorChat(prev => [...prev, { role: 'user', content: messageToSend }]);
    setTutorMsg('');
    setIsTutorLoading(true);

    try {
      const res = await api.post('/ai/tutor/chat', null, {
        params: { message: messageToSend, session_token: tutorSession }
      });
      setTutorChat(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      // Fallback to /ai/chat if available
      try {
        const fallbackRes = await api.post('/ai/chat', {
          message: messageToSend,
          session_id: tutorSession
        });
        setTutorChat(prev => [...prev, { role: 'assistant', content: fallbackRes.data.response }]);
      } catch (fallbackErr) {
        toast.error('AI Tutor failed to respond. Please try again.');
      }
    } finally {
      setIsTutorLoading(false);
    }
  };

  // Analyze and Debug Code
  const handleDebugCode = async (e) => {
    e.preventDefault();
    if (!debugCode.trim()) {
      toast.error('Please provide code to analyze.');
      return;
    }
    setIsDebugLoading(true);
    setDebugResult(null);

    try {
      // Send to debug endpoint
      const res = await api.post('/ai/debug', {
        code: debugCode,
        language: debugLang,
        error_message: debugError.trim() || undefined
      });
      setDebugResult(res.data);
      toast.success('Code analysis complete!');
    } catch (err) {
      // Fallback to tutor chat debug prompt
      try {
        const prompt = `Please debug and explain this ${debugLang} code:\n\`\`\`${debugLang}\n${debugCode}\n\`\`\`\nError: ${debugError || 'None specified'}\nProvide: 1. Diagnosis of bugs, 2. Corrected code, 3. Explanation and time/space complexity.`;
        const res = await api.post('/ai/tutor/chat', null, {
          params: { message: prompt, session_token: `debug_${Date.now()}` }
        });
        setDebugResult({
          explanation: res.data.reply,
          fixed_code: null
        });
        toast.success('Code analysis complete!');
      } catch (fallbackErr) {
        toast.error('Code debugging failed. Check service connectivity.');
      }
    } finally {
      setIsDebugLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
          margin-bottom: 0.75rem;
        }
        .markdown-content p:last-child {
          margin-bottom: 0;
        }
        .markdown-content ul, .markdown-content ol {
          margin-left: 1.25rem;
          margin-bottom: 0.75rem;
        }
        .markdown-content ul { list-style-type: disc; }
        .markdown-content ol { list-style-type: decimal; }
        .markdown-content li {
          margin-bottom: 0.25rem;
        }
        .markdown-content code {
          font-family: var(--font-mono);
          background-color: #283142;
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: var(--accent-primary);
        }
        .markdown-content pre {
          background-color: #0B0F17;
          border: 1px solid var(--border-primary);
          padding: 0.75rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.75rem 0;
          text-align: left;
        }
        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
          font-size: 0.82rem;
          color: #E2E8F0;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          font-weight: var(--fw-semibold);
          color: var(--accent-primary);
        }
        .markdown-content h1 { font-size: 1.2rem; border-bottom: 1px solid var(--border-primary); padding-bottom: 0.25rem; }
        .markdown-content h2 { font-size: 1.1rem; }
        .markdown-content h3 { font-size: 1rem; }
        .markdown-content blockquote {
          border-left: 4px solid var(--accent-primary);
          background-color: #161B26;
          margin: 0.75rem 0;
          padding: 0.4rem 0.8rem;
          border-radius: 0 4px 4px 0;
          color: var(--text-secondary);
        }
      `}</style>
      
      {/* Top Banner Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>
          <FiCpu style={{ color: 'var(--accent-primary)', marginRight: '10px' }} /> Study Assistant
        </h1>
        <p style={styles.subtitle}>
          Ask conceptual programming questions, debug code, or explore topics from your courses.
        </p>
      </div>

      {/* Main split-screen panel (Sidebar Left, Workspace Right) */}
      <div style={styles.workspaceSplit}>
        
        {/* Left Navigation Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarBrand}>
            <span>AI TOOLS</span>
          </div>

          <div style={styles.sidebarMenu}>
            <button 
              onClick={() => setActiveTab('tutor')} 
              style={activeTab === 'tutor' ? { ...styles.sidebarTab, ...styles.sidebarTabActive } : styles.sidebarTab}
            >
              <FiMessageSquare size={16} /> <span>AI Tutor Chat</span>
            </button>
            <button 
              onClick={() => setActiveTab('debugger')} 
              style={activeTab === 'debugger' ? { ...styles.sidebarTab, ...styles.sidebarTabActive } : styles.sidebarTab}
            >
              <FiCode size={16} /> <span>Code Debugger</span>
            </button>
          </div>

          {/* Real Courses from Database */}
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={styles.sidebarBrand}>
              <span>COURSE TOPICS</span>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
              {courses.length > 0 ? (
                courses.map(course => (
                  <button
                    key={course.id}
                    onClick={() => {
                      setActiveTab('tutor');
                      handleTutorSend(`Explain the core principles and concepts of "${course.title}".`);
                    }}
                    style={styles.courseChipBtn}
                    title={`Ask about ${course.title}`}
                  >
                    <FiBookOpen size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={styles.courseChipText}>{course.title}</span>
                  </button>
                ))
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem' }}>
                  {isCoursesLoading ? 'Loading courses...' : 'Browse catalog for topics.'}
                </div>
              )}
            </div>
          </div>

          {/* Quick Prompts */}
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '0.75rem', marginTop: 'auto' }}>
            <div style={styles.sidebarBrand}>
              <span>QUICK PROMPTS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
              {[
                'Explain Big-O Complexity',
                'How Recursion Works',
                'REST vs GraphQL APIs',
                'Clean Code Principles'
              ].map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveTab('tutor');
                    handleTutorSend(promptText);
                  }}
                  style={styles.quickPromptBtn}
                >
                  {promptText} →
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content Workspace Panel */}
        <div style={styles.mainPanel}>
          
          {/* Workspace Area: 1. AI Tutor Chat */}
          {activeTab === 'tutor' && (
            <div style={styles.workspace}>
              <div style={styles.workspaceHeader}>
                <div>
                  <h3 style={styles.workspaceTitle}>AI Tutor Chat</h3>
                  <span style={styles.workspaceSubtitle}>Interactive debugging tutor and conceptual guide</span>
                </div>
                <button onClick={handleClearTutorChat} style={styles.clearBtn} title="Clear conversation memory">
                  <FiTrash2 /> Reset Session
                </button>
              </div>

              <div style={styles.tutorLogs}>
                {tutorChat.map((m, idx) => (
                  <div key={idx} style={{
                    ...styles.chatBubble,
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: m.role === 'user' ? '#272F45' : '#161B26',
                    borderColor: m.role === 'user' ? 'var(--accent-primary)' : 'var(--border-primary)',
                    borderRadius: m.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    maxWidth: '85%'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '0.75rem', color: m.role === 'user' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        {m.role === 'user' ? 'You' : 'AI Tutor'}
                      </strong>
                      <button onClick={() => copyToClipboard(m.content)} style={styles.copyBtn} title="Copy response">
                        <FiCopy size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>{renderFormattedContent(m.content)}</div>
                  </div>
                ))}
                {isTutorLoading && (
                  <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#161B26', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    <FiClock className="spin-icon" /> AI is drafting explanation...
                  </div>
                )}
                <div ref={tutorEndRef} />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleTutorSend(); }} style={styles.inputForm}>
                <button 
                  type="button" 
                  onClick={() => startSpeechRecognition(setTutorMsg)} 
                  style={{ ...styles.speechBtn, backgroundColor: isListening ? 'var(--color-error)' : '#1E2533' }}
                  title="Voice dictation"
                >
                  {isListening ? <FiMicOff /> : <FiMic />}
                </button>
                <input 
                  type="text" 
                  value={tutorMsg}
                  onChange={(e) => setTutorMsg(e.target.value)}
                  placeholder="Ask your tutor anything (or use the microphone button to dictate)..."
                  style={styles.chatInput}
                />
                <LoadingButton type="submit" loading={isTutorLoading} loadingText="" style={styles.sendBtn} aria-label="Send">
                  <FiSend />
                </LoadingButton>
              </form>
            </div>
          )}

          {/* Workspace Area: 2. Code Debugger */}
          {activeTab === 'debugger' && (
            <div style={styles.debuggerWorkspace}>
              
              {/* Left Input Pane */}
              <div style={styles.debugInputPane}>
                <div style={styles.workspaceHeader}>
                  <div>
                    <h3 style={styles.workspaceTitle}>Code Debugger</h3>
                    <span style={styles.workspaceSubtitle}>Identify syntax errors, logic flaws, and optimize algorithms</span>
                  </div>
                  <select 
                    value={debugLang} 
                    onChange={(e) => setDebugLang(e.target.value)}
                    style={styles.langSelect}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="go">Go</option>
                  </select>
                </div>

                <form onSubmit={handleDebugCode} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <label style={styles.inputLabel}>Code to Debug:</label>
                    <textarea 
                      value={debugCode}
                      onChange={(e) => setDebugCode(e.target.value)}
                      placeholder="Paste your code snippet here..."
                      style={styles.codeTextarea}
                      spellCheck="false"
                      required
                    />
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    <label style={styles.inputLabel}>Error Message or Traceback (Optional):</label>
                    <input 
                      type="text"
                      value={debugError}
                      onChange={(e) => setDebugError(e.target.value)}
                      placeholder="e.g. TypeError, IndexError, or test case failure"
                      style={styles.chatInput}
                    />
                  </div>

                  <LoadingButton 
                    type="submit" 
                    loading={isDebugLoading} 
                    loadingText="Analyzing Code..." 
                    style={styles.debugSubmitBtn}
                  >
                    <FiTerminal /> Analyze & Debug Code
                  </LoadingButton>
                </form>
              </div>

              {/* Right Output Pane */}
              <div style={styles.debugOutputPane}>
                <div style={styles.workspaceHeader}>
                  <div>
                    <h3 style={styles.workspaceTitle}>Diagnostic Result</h3>
                    <span style={styles.workspaceSubtitle}>AI breakdown, bug identification, and fix</span>
                  </div>
                </div>

                <div style={styles.debugResultBody}>
                  {debugResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {debugResult.fixed_code && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <strong style={{ fontSize: '0.8rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiCheckCircle /> Corrected Code:
                            </strong>
                            <button 
                              onClick={() => copyToClipboard(debugResult.fixed_code)}
                              style={styles.copyBtn}
                              title="Copy fixed code"
                            >
                              <FiCopy size={12} /> Copy Code
                            </button>
                          </div>
                          <pre style={styles.resultPre}>
                            <code>{debugResult.fixed_code}</code>
                          </pre>
                        </div>
                      )}

                      {debugResult.explanation && (
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                            Explanation & Fix:
                          </strong>
                          <div style={styles.resultExplanation}>
                            {renderFormattedContent(debugResult.explanation)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={styles.emptyDebugState}>
                      <FiCode size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Paste code on the left and click <strong>Analyze & Debug Code</strong> to get instant AI diagnostics.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Interactive Side Canvas Workspace */}
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
    </div>
  );
}

const styles = {
  container: {
    padding: '0.25rem 0 1rem 0',
    maxWidth: '100%',
    margin: '0',
    width: '100%',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 130px)',
    minHeight: 0,
    boxSizing: 'border-box'
  },
  header: {
    marginBottom: '0.65rem',
    flexShrink: 0
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.2rem',
    display: 'flex',
    alignItems: 'center'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.85rem'
  },
  workspaceSplit: {
    display: 'flex',
    flex: 1,
    gap: '1.25rem',
    minHeight: 0,
    overflow: 'hidden'
  },
  
  // Left Navigation Sidebar
  sidebar: {
    width: '250px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    flexShrink: 0,
    minHeight: 0
  },
  sidebarBrand: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    fontWeight: 'var(--fw-bold)',
    paddingLeft: '0.5rem',
    marginBottom: '0.25rem'
  },
  sidebarMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  sidebarTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.6rem 0.85rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-medium)',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer'
  },
  sidebarTabActive: {
    backgroundColor: '#272F45',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)'
  },
  courseChipBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.65rem',
    backgroundColor: '#161B26',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '0.78rem'
  },
  courseChipText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1
  },
  quickPromptBtn: {
    padding: '0.4rem 0.65rem',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: '4px'
  },

  // Main panel wrapper
  mainPanel: {
    flex: 1,
    display: 'flex',
    minWidth: 0,
    height: '100%',
    minHeight: 0
  },

  // Single Panel Workspace (Tutor)
  workspace: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    minHeight: 0,
    flex: 1
  },
  workspaceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.85rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.65rem',
    flexShrink: 0
  },
  workspaceTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 'var(--fw-semibold)'
  },
  workspaceSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  tutorLogs: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '0.85rem',
    paddingRight: '0.5rem',
    minHeight: 0
  },
  chatBubble: {
    padding: '0.75rem 1rem',
    border: '1px solid',
    lineHeight: '1.5'
  },
  inputForm: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0
  },
  speechBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 0.85rem',
    cursor: 'pointer'
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.65rem 0.85rem',
    outline: 'none',
    fontSize: '0.875rem'
  },
  sendBtn: {
    padding: '0 1.15rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer'
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem'
  },
  copyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.72rem'
  },

  // Code Debugger Two-Pane Workspace
  debuggerWorkspace: {
    display: 'flex',
    gap: '1.25rem',
    height: '100%',
    width: '100%',
    minHeight: 0,
    flex: 1
  },
  debugInputPane: {
    flex: 1,
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  debugOutputPane: {
    flex: 1,
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  inputLabel: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-secondary)',
    marginBottom: '0.35rem'
  },
  codeTextarea: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.82rem',
    padding: '0.75rem',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.45',
    minHeight: '180px'
  },
  langSelect: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    outline: 'none'
  },
  debugSubmitBtn: {
    padding: '0.65rem 1.25rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-semibold)'
  },
  debugResultBody: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  resultPre: {
    backgroundColor: '#0B0F17',
    border: '1px solid var(--border-primary)',
    padding: '0.85rem',
    borderRadius: '6px',
    overflowX: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.82rem',
    color: '#34D399',
    margin: 0
  },
  resultExplanation: {
    backgroundColor: '#161B26',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '0.85rem',
    fontSize: '0.85rem',
    lineHeight: '1.5'
  },
  emptyDebugState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    padding: '2rem'
  },

  // Code Block Inside Tutor Messages
  codeWrapper: {
    margin: '0.75rem 0',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  codeHeader: {
    backgroundColor: '#1E2533',
    padding: '0.4rem 0.75rem',
    borderBottom: '1px solid var(--border-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  codeHeaderBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '3px'
  },
  openCanvasBtn: {
    background: '#272F45',
    border: '1px solid var(--border-primary)',
    color: 'var(--accent-primary)',
    fontSize: '0.72rem',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '3px'
  },

  // Interactive Side Canvas Panel
  canvasPanel: {
    width: '380px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minHeight: 0
  },
  canvasHeader: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid var(--border-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  canvasTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)'
  },
  canvasSubtitle: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)'
  },
  canvasActionBtn: {
    background: 'transparent',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    padding: '3px 7px',
    fontSize: '0.72rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '3px'
  },
  canvasCloseBtn: {
    background: 'transparent',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-muted)',
    borderRadius: '4px',
    padding: '3px 7px',
    fontSize: '0.72rem',
    cursor: 'pointer'
  },
  canvasBody: {
    flex: 1,
    minHeight: 0,
    padding: '0.5rem'
  },
  canvasTextarea: {
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.82rem',
    padding: '0.75rem',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.45'
  }
};
