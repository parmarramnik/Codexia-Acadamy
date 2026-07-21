import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import LoadingButton from '../components/common/LoadingButton';
import { 
  FiCpu, 
  FiMessageSquare, 
  FiFileText, 
  FiBriefcase, 
  FiCalendar, 
  FiSend, 
  FiPlay, 
  FiAward,
  FiTrash2,
  FiUploadCloud,
  FiCopy,
  FiMic,
  FiMicOff,
  FiCode,
  FiCheckCircle,
  FiClock,
  FiBookOpen
} from 'react-icons/fi';

export default function EnterpriseAI() {
  const [activeTab, setActiveTab] = useState('tutor'); // tutor | resume | planner
  
  // AI Tutor state
  const [tutorSession, setTutorSession] = useState(() => `tutor_${Date.now()}`);
  const [tutorMsg, setTutorMsg] = useState('');
  const [tutorChat, setTutorChat] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Tutor. Ask me any conceptual questions or code debugging questions!' }
  ]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);



  // Resume state
  const [resumeText, setResumeText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [resumeFeedback, setResumeFeedback] = useState(null);
  const [isResumeLoading, setIsResumeLoading] = useState(false);

  // Study Planner state
  const [courseTitle, setCourseTitle] = useState('');
  const [studyPlan, setStudyPlan] = useState(null);
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);

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
        toast.error('Microphone blocked. Please click the microphone lock in your browser address bar and grant access.');
      } else if (event.error === 'no-speech') {
        toast.error('No speech detected. Please try again.');
      } else if (event.error === 'aborted') {
        toast.error('Speech recognition stopped.');
      } else {
        toast.error(`Mic Error: ${event.error || 'check audio settings'}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Structured Content Formatter
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
          {text}
        </ReactMarkdown>
      </div>
    );
  };

  // Clear Tutor Chat History
  const handleClearTutorChat = () => {
    setTutorSession(`tutor_${Date.now()}`);
    setTutorChat([
      { role: 'assistant', content: 'Tutor memory cleared! Let\'s begin a new conceptual lesson.' }
    ]);
    setActiveCanvasCode(null);
    toast.success('Conversation memory reset.');
  };

  // Send Tutor Chat
  const handleTutorSend = async (e) => {
    e.preventDefault();
    if (!tutorMsg.trim()) return;
    const userMsg = tutorMsg;
    setTutorChat(prev => [...prev, { role: 'user', content: userMsg }]);
    setTutorMsg('');
    setIsTutorLoading(true);
    try {
      const res = await api.post('/ai/tutor/chat', null, {
        params: { message: userMsg, session_token: tutorSession }
      });
      setTutorChat(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      toast.error('AI Tutor failed to respond');
    } finally {
      setIsTutorLoading(false);
    }
  };



  // Analyze Resume
  const handleAnalyzeResume = async (e) => {
    e.preventDefault();
    if (!resumeText.trim() && !selectedFile) {
      toast.error('Please paste resume text or upload a PDF file.');
      return;
    }
    setIsResumeLoading(true);
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('resume_text', resumeText);
      }
      
      const res = await api.post('/ai/career/resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setResumeFeedback(res.data);
      toast.success('Resume analyzed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Resume audit failed');
    } finally {
      setIsResumeLoading(false);
    }
  };

  // Generate Plan
  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    if (!courseTitle.trim()) return;
    setIsPlannerLoading(true);
    try {
      const res = await api.post('/ai/planner/weekly', null, {
        params: { course_title: courseTitle, hours_weekly: 12 }
      });
      setStudyPlan(res.data);
      toast.success('Weekly plan generated!');
    } catch (err) {
      toast.error('Failed to generate study planner');
    } finally {
      setIsPlannerLoading(false);
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
          background-color: rgba(255, 255, 255, 0.08);
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          font-size: 0.85rem;
          color: var(--accent-primary);
        }
        .markdown-content pre {
          background-color: rgba(0, 0, 0, 0.4);
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
          font-size: 0.8rem;
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
          background-color: rgba(255, 255, 255, 0.02);
          margin: 0.75rem 0;
          padding: 0.4rem 0.8rem;
          border-radius: 0 4px 4px 0;
          color: var(--text-secondary);
        }
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.8rem;
        }
        .markdown-content th, .markdown-content td {
          border: 1px solid var(--border-primary);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .markdown-content th {
          background-color: rgba(255, 255, 255, 0.04);
        }
      `}</style>
      
      {/* Top Banner Header */}
      <div style={styles.header}>
        <h1 style={styles.title}><FiCpu style={{ color: 'var(--accent-primary)', marginRight: '8px' }} /> Enterprise AI Suite</h1>
        <p style={styles.subtitle}>Unlock resume gap analysis, custom roadmaps, and context-aware coding tutors.</p>
      </div>

      {/* Main split-screen panel (Sidebar Left, Workspace Right) */}
      <div style={styles.workspaceSplit}>
        
        {/* Left Navigation Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarBrand}>
            <span>AI ASSISTANTS</span>
          </div>
          <div style={styles.sidebarMenu}>
            <button onClick={() => setActiveTab('tutor')} style={activeTab === 'tutor' ? { ...styles.sidebarTab, ...styles.sidebarTabActive } : styles.sidebarTab}>
              <FiMessageSquare size={16} /> <span>AI Tutor Chat</span>
            </button>
            <button onClick={() => setActiveTab('planner')} style={activeTab === 'planner' ? { ...styles.sidebarTab, ...styles.sidebarTabActive } : styles.sidebarTab}>
              <FiCalendar size={16} /> <span>Roadmap Planner</span>
            </button>
          </div>
        </div>

        {/* Right Content Workspace Panel */}
        <div style={styles.mainPanel}>
          
          {/* Workspace Area: 1. AI Tutor */}
          {activeTab === 'tutor' && (
            <div style={styles.workspace}>
              <div style={styles.workspaceHeader}>
                <div>
                  <h3 style={styles.workspaceTitle}>AI Tutor Chat</h3>
                  <span style={styles.workspaceSubtitle}>Interactive debugging tutor and conceptual guide</span>
                </div>
                <button onClick={handleClearTutorChat} style={styles.clearBtn}>
                  <FiTrash2 /> Reset Session
                </button>
              </div>

              <div style={styles.tutorLogs}>
                {tutorChat.map((m, idx) => (
                  <div key={idx} style={{
                    ...styles.chatBubble,
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: m.role === 'user' ? 'rgba(255, 161, 22, 0.15)' : 'rgba(255,255,255,0.02)',
                    borderColor: m.role === 'user' ? 'var(--accent-primary)' : 'var(--border-primary)',
                    borderRadius: m.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    maxWidth: '85%'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '0.75rem', color: m.role === 'user' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        {m.role === 'user' ? 'You' : 'AI Tutor'}
                      </strong>
                      <button onClick={() => copyToClipboard(m.content)} style={styles.copyBtn} title="Copy explanation">
                        <FiCopy size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>{renderFormattedContent(m.content)}</div>
                  </div>
                ))}
                {isTutorLoading && (
                  <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    <FiClock className="spin-icon" /> AI is drafting explanation...
                  </div>
                )}
                <div ref={tutorEndRef} />
              </div>

              <form onSubmit={handleTutorSend} style={styles.inputForm}>
                <button 
                  type="button" 
                  onClick={() => startSpeechRecognition(setTutorMsg)} 
                  style={{ ...styles.speechBtn, backgroundColor: isListening ? 'var(--color-error)' : 'rgba(255,255,255,0.03)' }}
                  title="Speak message"
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
                <LoadingButton type="submit" loading={isTutorLoading} loadingText="" style={styles.sendBtn} aria-label="Send"><FiSend /></LoadingButton>
              </form>
            </div>
          )}



          {/* Workspace Area: 3. Resume Gap Analyzer */}
          {activeTab === 'resume' && (
            <div style={styles.splitWorkspace}>
              
              {/* Form Input panel */}
              <div style={styles.formPanel}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>AI Resume Auditor</h3>
                  <span style={styles.panelSubtitle}>Bridge skills gaps with recommended courses</span>
                </div>
                
                <form onSubmit={handleAnalyzeResume} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={styles.uploadBox}>
                    <FiUploadCloud size={24} style={{ color: 'var(--accent-primary)', marginBottom: '0.25rem' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>Drop PDF Resume here or click to browse</span>
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={(e) => {
                        setSelectedFile(e.target.files[0]);
                        setResumeText(''); // clear text choice
                      }}
                      style={styles.fileInput}
                    />
                    {selectedFile && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginTop: '0.4rem', fontWeight: 'bold' }}>
                        Selected: {selectedFile.name}
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 'bold' }}>— OR PASTE TEXT —</div>

                  <textarea 
                    value={resumeText} 
                    onChange={(e) => {
                      setResumeText(e.target.value);
                      setSelectedFile(null); // clear file choice
                    }} 
                    placeholder="Paste plain resume markdown or text contents here..."
                    style={styles.textarea}
                    disabled={!!selectedFile}
                  />

                  <LoadingButton type="submit" loading={isResumeLoading} loadingText="Performing Audit..." style={styles.startBtn}>
                    Analyze Resume
                  </LoadingButton>
                </form>
              </div>

              {/* Feedback panel */}
              <div style={styles.resultsPanel}>
                {resumeFeedback ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Audit Scorecard</h4>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', padding: '1rem', borderRadius: '6px', textAlign: 'center', flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Resume Score</span>
                          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{resumeFeedback.score}/100</div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', padding: '1rem', borderRadius: '6px', flex: 2 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Identified Skillsets</span>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {resumeFeedback.skills_found?.map((s, idx) => (
                              <span key={idx} style={styles.tag}>{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>AI Placement Suggestions</h4>
                      <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', padding: '1.25rem', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        <div className="markdown-content">
                          <ReactMarkdown>{resumeFeedback.suggestions}</ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Gap Bridging Courses</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {resumeFeedback.recommended_courses && resumeFeedback.recommended_courses.length > 0 ? (
                          resumeFeedback.recommended_courses.map(c => (
                            <a key={c.id} href={`/courses/${c.slug}`} style={styles.courseLinkCard}>
                              <FiBookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
                              <div>
                                <strong style={{ fontSize: '0.85rem' }}>{c.title}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Learn topics & get certified →</div>
                              </div>
                            </a>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No courses found inside catalog matching gap analysis.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={styles.emptyResultsBox}>
                    <FiFileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <p>No audit results yet. Fill in your resume details on the left to begin.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Workspace Area: 4. Study Planner */}
          {activeTab === 'planner' && (
            <div style={styles.splitWorkspace}>
              
              {/* Form Input panel */}
              <div style={styles.formPanel}>
                <div style={styles.panelHeader}>
                  <h3 style={styles.panelTitle}>Roadmap Planner</h3>
                  <span style={styles.panelSubtitle}>Personalized curriculum scheduler and timeline path</span>
                </div>
                
                <form onSubmit={handleGeneratePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={styles.label}>What do you want to learn?</label>
                  <input 
                    type="text" 
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g. AWS Kubernetes Architect, Go Microservices"
                    style={styles.input}
                    required
                  />
                  
                  <LoadingButton type="submit" loading={isPlannerLoading} loadingText="Planning Path..." style={styles.startBtn}>
                    Generate Study Planner
                  </LoadingButton>
                </form>
              </div>

              {/* Planner roadmap display */}
              <div style={styles.resultsPanel}>
                {studyPlan ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Weekly Roadmap: {studyPlan.course}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Time Commitment: {studyPlan.target_hours} Hours/Week</span>
                    </div>

                    <div style={styles.roadmapSequence}>
                      {studyPlan.schedule?.map((day, idx) => (
                        <div key={idx} style={styles.roadmapStepCard}>
                          <div style={styles.roadmapStepBullet}>
                            <FiCheckCircle size={18} style={{ color: 'var(--accent-primary)' }} />
                          </div>
                          <div style={styles.roadmapStepContent}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <strong>{day.day}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-light)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>{day.mins} Mins</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{day.topic}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={styles.emptyResultsBox}>
                    <FiCalendar size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <p>No study plans generated yet. Enter your target topic on the left to start.</p>
                  </div>
                )}
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
    padding: '1rem 1.5rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 165px)',
    minHeight: 0
  },
  header: {
    marginBottom: '1rem',
    flexShrink: 0
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
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
    gap: '1.5rem',
    minHeight: 0,
    overflow: 'hidden'
  },
  
  // Left Navigation Sidebar
  sidebar: {
    width: '240px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flexShrink: 0,
    minHeight: 0
  },
  sidebarBrand: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    fontWeight: 'var(--fw-bold)',
    paddingLeft: '0.75rem'
  },
  sidebarMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem'
  },
  sidebarTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.65rem 1rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  sidebarTabActive: {
    backgroundColor: 'rgba(255, 161, 22, 0.1)',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)'
  },

  // Main panel wrapper
  mainPanel: {
    flex: 1,
    display: 'flex',
    minWidth: 0,
    gap: '1.5rem',
    height: '100%',
    minHeight: 0
  },

  // Single Panel Workspace (Tutor/Interview)
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
    marginBottom: '1rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem'
  },
  workspaceTitle: {
    margin: 0,
    fontSize: '1.1rem',
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
    marginBottom: '1rem',
    paddingRight: '0.5rem'
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
    padding: '0 1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  chatInput: {
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
    padding: '0 1.25rem',
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
    alignItems: 'center'
  },

  // Mock Interview Setup Layout
  setupView: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%'
  },
  setupCard: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem',
    width: '450px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  select: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%'
  },
  startBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'
  },
  dialogueLogs: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1rem',
    paddingRight: '0.5rem'
  },
  feedbackCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '1rem',
    height: '100%'
  },
  scoreText: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: 'var(--accent-primary)'
  },
  feedbackBody: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: '1rem 1.5rem',
    borderRadius: '6px',
    border: '1px solid var(--border-primary)',
    textAlign: 'left'
  },

  // Split Panel Workspace (Resume/Planner)
  splitWorkspace: {
    display: 'flex',
    gap: '2rem',
    height: '100%',
    width: '100%',
    minHeight: 0,
    flex: 1
  },
  formPanel: {
    flex: 1,
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    overflowY: 'auto'
  },
  panelHeader: {
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
    marginBottom: '0.5rem'
  },
  panelTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 'var(--fw-semibold)'
  },
  panelSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  resultsPanel: {
    flex: 1.5,
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    overflowY: 'auto',
    height: '100%'
  },
  emptyResultsBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '2rem'
  },

  // Resume Auditing Styles
  uploadBox: {
    border: '2px dashed var(--border-primary)',
    borderRadius: '6px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.01)',
    transition: 'background-color 0.2s'
  },
  fileInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer'
  },
  textarea: {
    width: '100%',
    height: '100px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.75rem',
    outline: 'none',
    fontSize: '0.85rem',
    resize: 'none'
  },
  tag: {
    backgroundColor: 'rgba(255, 161, 22, 0.1)',
    border: '1px solid var(--accent-primary)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: 'var(--accent-primary)'
  },
  courseLinkCard: {
    color: 'var(--text-primary)',
    textDecoration: 'none',
    backgroundColor: 'rgba(255,255,255,0.01)',
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    border: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    transition: 'all 0.2s'
  },
  input: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.75rem',
    outline: 'none',
    fontSize: '0.875rem'
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-secondary)'
  },

  // Roadmap Sequence List
  roadmapSequence: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '0.5rem'
  },
  roadmapStepCard: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.01)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '1rem'
  },
  roadmapStepBullet: {
    marginTop: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  roadmapStepContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
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
    width: '40%',
    borderLeft: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100%'
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
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    resize: 'none'
  }
};
