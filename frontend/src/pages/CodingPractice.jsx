import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import { 
  FiCode, 
  FiPlay, 
  FiCheck, 
  FiX, 
  FiAlertCircle, 
  FiAward, 
  FiClock, 
  FiTerminal, 
  FiChevronUp, 
  FiChevronDown, 
  FiBookOpen, 
  FiDatabase,
  FiCpu,
  FiStar,
  FiMaximize2
} from 'react-icons/fi';

export default function CodingPractice() {
  const { slug } = useParams();
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  
  // Monaco configurations
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState('on');
  const [fullScreen, setFullScreen] = useState(false);
  
  // Layout states
  const [leftTab, setLeftTab] = useState('description'); // 'description' | 'submissions' | 'ai'
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState('testcase'); // 'testcase' | 'result'
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  
  // Data states
  const [submissions, setSubmissions] = useState([]);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
  const [results, setResults] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [aiReview, setAiReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(false);

  // Default starter codes
  const starterCode = {
    python: 'def solve():\n    # Write your Python code here\n    pass\n',
    javascript: 'function solve() {\n    // Write your JavaScript code here\n}\n',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    return 0;\n}\n',
    c: '#include <stdio.h>\n\nint main() {\n    // Write C code here\n    return 0;\n}\n',
    java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java code here\n    }\n}\n',
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    // Write Go code here\n}\n'
  };

  // Fetch coding problems list and first problem details
  useEffect(() => {
    async function loadProblems() {
      setIsLoading(true);
      let items = [];
      try {
        const res = await api.get('/coding/problems');
        items = res.data.items || [];
        setProblems(items);
      } catch (err) {
        toast.error('Failed to load coding problems');
        setIsLoading(false);
        return;
      }

      const activeSlug = slug || (items.length > 0 ? items[0].slug : null);
      if (activeSlug) {
        try {
          const detailRes = await api.get(`/coding/problems/${activeSlug}`);
          setSelectedProblem(detailRes.data);
          setCode(detailRes.data.starter_code_python || starterCode.python);
          
          // Fetch favorites
          try {
            const favsRes = await api.get('/coding/problems/favorites');
            const isAlreadyFav = (favsRes.data || []).some(f => f.problem_id === detailRes.data.id);
            setIsFav(isAlreadyFav);
          } catch(e) {}
        } catch (err) {
          toast.error('Failed to load problem details');
        }
      }
      setIsLoading(false);
    }
    loadProblems();
  }, [slug]);

  // Update starter code when language changes
  useEffect(() => {
    if (!selectedProblem) return;
    if (language === 'python') setCode(selectedProblem.starter_code_python || starterCode.python);
    if (language === 'javascript') setCode(selectedProblem.starter_code_javascript || starterCode.javascript);
    if (language === 'cpp') setCode(selectedProblem.starter_code_cpp || starterCode.cpp);
    if (language === 'c') setCode(starterCode.c);
    if (language === 'java') setCode(selectedProblem.starter_code_java || starterCode.java);
    if (language === 'go') setCode(starterCode.go);
  }, [language, selectedProblem]);

  // Fetch submissions when Left Tab changes to 'submissions'
  useEffect(() => {
    if (leftTab === 'submissions' && selectedProblem) {
      loadSubmissions();
    }
  }, [leftTab, selectedProblem]);

  const loadSubmissions = async () => {
    if (!selectedProblem) return;
    setIsSubmissionsLoading(true);
    try {
      const res = await api.get(`/coding/problems/${selectedProblem.id}/submissions`);
      setSubmissions(res.data || []);
    } catch (err) {
      toast.error('Failed to load submissions');
    } finally {
      setIsSubmissionsLoading(false);
    }
  };

  const handleRun = async () => {
    if (!selectedProblem) return;
    setIsRunning(false);
    setIsRunning(true);
    setConsoleOpen(true);
    setConsoleTab('result');
    setResults(null);
    setActiveCaseIndex(0);
    try {
      const res = await api.post(`/coding/problems/${selectedProblem.id}/run`, {
        language,
        code
      });
      setResults({
        status: res.data.passed === res.data.total ? 'Accepted' : 'Wrong Answer',
        passed: res.data.passed,
        total: res.data.total,
        test_results: res.data.test_results || [],
        error_message: res.data.error_message,
        type: 'run'
      });
      if (res.data.passed === res.data.total) {
        toast.success('Sample test cases passed!');
      } else {
        toast.error('Some sample test cases failed');
      }
    } catch (err) {
      toast.error('Error running code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProblem) return;
    setIsSubmitting(true);
    setConsoleOpen(true);
    setConsoleTab('result');
    setResults(null);
    setActiveCaseIndex(0);
    try {
      const res = await api.post(`/coding/problems/${selectedProblem.id}/submit`, {
        language,
        code
      });
      const isAccepted = res.data.status === 'ACCEPTED' || res.data.status === 'accepted';
      setResults({
        status: res.data.status,
        passed: res.data.test_cases_passed,
        total: res.data.test_cases_total,
        test_results: [], // Submission response does not return test results detail for security
        error_message: res.data.error_message,
        execution_time_ms: res.data.execution_time_ms,
        type: 'submit'
      });
      if (isAccepted) {
        toast.success('Congratulations! All test cases passed.');
        // Refresh submissions if tab is open
        if (leftTab === 'submissions') loadSubmissions();
      } else {
        toast.error(`Submission failed: ${(res.data.status || 'failed').replace('_', ' ').toLowerCase()}`);
      }
    } catch (err) {
      toast.error('Error submitting code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFav = async () => {
    if (!selectedProblem) return;
    try {
      const res = await api.post(`/coding/problems/${selectedProblem.id}/favorite`);
      setIsFav(res.data.favorited);
      toast.success(res.data.status === 'added' ? 'Added to favorites!' : 'Removed from favorites!');
    } catch (err) {
      toast.error('Failed to update favorite status');
    }
  };

  const handleAIReview = async () => {
    if (!selectedProblem) return;
    setIsReviewing(true);
    setLeftTab('ai');
    setAiReview(null);
    try {
      const res = await api.post('/ai/coding/review', {
        code,
        language,
        problem_title: selectedProblem.title
      });
      setAiReview(res.data);
      toast.success('AI Code Review completed!');
    } catch (err) {
      toast.error('AI Code Review failed');
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Configuring interactive coding workspace...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(30, 30, 30, 0.5);
        }
        ::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
        /* Custom animations & interactive elements */
        .tab-btn {
          position: relative;
          transition: color 0.2s ease;
        }
        .tab-btn:hover {
          color: var(--text-primary) !important;
        }
        .problem-link:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .action-icon {
          transition: transform 0.2s ease;
        }
        .action-icon:hover {
          transform: scale(1.1);
        }
      `}</style>

      {/* Left Sidebar: Problems list */}
      <div style={styles.problemsSidebar}>
        <h2 style={styles.sidebarTitle}>Problems</h2>
        <div style={styles.problemsList}>
          {problems.map((p) => {
            const isSelected = selectedProblem?.id === p.id;
            return (
              <Link
                key={p.id}
                to={`/coding/${p.slug}`}
                className="problem-link"
                style={isSelected ? { ...styles.problemItem, ...styles.problemItemSelected } : styles.problemItem}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={styles.problemTitle}>{p.title}</span>
                  <span style={{
                    ...styles.diffBadge,
                    color: p.difficulty.toLowerCase() === 'easy' ? 'var(--color-success)' : p.difficulty.toLowerCase() === 'medium' ? 'var(--color-warning)' : 'var(--color-error)'
                  }}>{p.difficulty}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Sandbox Area */}
      {selectedProblem ? (
        <div style={styles.sandboxArea}>
          
          {/* Left panel: Description / Submissions */}
          <div style={styles.leftPanel}>
            {/* Left Header Tabs */}
            <div style={styles.leftTabHeader}>
              <button
                className="tab-btn"
                onClick={() => setLeftTab('description')}
                style={leftTab === 'description' ? { ...styles.leftTabBtn, ...styles.leftTabBtnActive } : styles.leftTabBtn}
              >
                <FiBookOpen size={16} /> Description
              </button>
              <button
                className="tab-btn"
                onClick={() => setLeftTab('submissions')}
                style={leftTab === 'submissions' ? { ...styles.leftTabBtn, ...styles.leftTabBtnActive } : styles.leftTabBtn}
              >
                <FiDatabase size={16} /> Submissions
              </button>
              <button
                className="tab-btn"
                onClick={() => setLeftTab('ai')}
                style={leftTab === 'ai' ? { ...styles.leftTabBtn, ...styles.leftTabBtnActive } : styles.leftTabBtn}
              >
                <FiCpu size={16} /> AI Review
              </button>
            </div>

            {/* Left Tab Content */}
            <div style={styles.leftTabContent}>
              {leftTab === 'description' ? (
                <div style={styles.descriptionWrapper}>
                  <div style={styles.questionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h1 style={styles.title}>{selectedProblem.title}</h1>
                      <button
                        onClick={toggleFav}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: isFav ? '#f1c40f' : 'var(--text-secondary)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Add to Favorites"
                      >
                        <FiStar size={20} fill={isFav ? '#f1c40f' : 'none'} />
                      </button>
                    </div>
                    <span style={{
                      ...styles.difficultyBadge,
                      backgroundColor: selectedProblem.difficulty.toLowerCase() === 'easy' ? 'rgba(46, 204, 113, 0.12)' : selectedProblem.difficulty.toLowerCase() === 'medium' ? 'rgba(243, 156, 18, 0.12)' : 'rgba(231, 76, 60, 0.12)',
                      color: selectedProblem.difficulty.toLowerCase() === 'easy' ? 'var(--color-success)' : selectedProblem.difficulty.toLowerCase() === 'medium' ? 'var(--color-warning)' : 'var(--color-error)'
                    }}>{selectedProblem.difficulty.toUpperCase()}</span>
                  </div>

                  <div style={styles.descContent}>
                    <p style={styles.descText}>{selectedProblem.description}</p>

                    {selectedProblem.input_format && (
                      <div style={styles.sectionBlock}>
                        <h4 style={styles.sectionHeading}>Input Format</h4>
                        <p style={styles.descText}>{selectedProblem.input_format}</p>
                      </div>
                    )}

                    {selectedProblem.output_format && (
                      <div style={styles.sectionBlock}>
                        <h4 style={styles.sectionHeading}>Output Format</h4>
                        <p style={styles.descText}>{selectedProblem.output_format}</p>
                      </div>
                    )}

                    {selectedProblem.constraints && (
                      <div style={styles.sectionBlock}>
                        <h4 style={styles.sectionHeading}>Constraints</h4>
                        <pre style={styles.constraintsBlock}>{selectedProblem.constraints}</pre>
                      </div>
                    )}

                    {/* Display Sample Test Cases as Examples */}
                    {selectedProblem.test_cases && selectedProblem.test_cases.length > 0 && (
                      <div style={styles.sectionBlock}>
                        <h4 style={styles.sectionHeading}>Examples</h4>
                        {selectedProblem.test_cases.filter(tc => !tc.is_hidden).slice(0, 3).map((tc, idx) => (
                          <div key={tc.id || idx} style={styles.exampleBlock}>
                            <h5 style={styles.exampleTitle}>Example {idx + 1}:</h5>
                            <div style={styles.exampleContent}>
                              <div style={{ marginBottom: '0.5rem' }}>
                                <span style={styles.exampleLabel}>Input:</span>
                                <pre style={styles.examplePre}>{tc.input_data}</pre>
                              </div>
                              <div>
                                <span style={styles.exampleLabel}>Output:</span>
                                <pre style={styles.examplePre}>{tc.expected_output}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : leftTab === 'submissions' ? (
                /* Submissions Panel */
                <div style={styles.submissionsWrapper}>
                  <h3 style={styles.sectionHeading}>Past Submissions</h3>
                  {isSubmissionsLoading ? (
                    <div style={styles.loadingContainer}>
                      <div style={styles.spinner}></div>
                      <p style={styles.loadingText}>Fetching history...</p>
                    </div>
                  ) : submissions.length === 0 ? (
                    <div style={styles.emptyState}>
                      <FiAward size={36} style={{ color: 'var(--text-secondary)' }} />
                      <p style={{ color: 'var(--text-secondary)' }}>No submissions yet for this problem.</p>
                    </div>
                  ) : (
                    <div style={styles.submissionsList}>
                      {submissions.map((sub) => {
                        const isExpanded = expandedSubmissionId === sub.id;
                        const subDate = new Date(sub.submitted_at).toLocaleString();
                        const isAccepted = sub.status === 'ACCEPTED' || sub.status === 'accepted';
                        return (
                           <div key={sub.id} style={styles.subCard}>
                            <div 
                              onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                              style={styles.subCardHeader}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{
                                  ...styles.subStatusBadge,
                                  color: isAccepted ? 'var(--color-success)' : 'var(--color-error)'
                                }}>
                                  {isAccepted ? 'Accepted' : (sub.status || 'Rejected').replace('_', ' ')}
                                </span>
                                <span style={styles.subLang}>{sub.language}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={styles.subMeta}><FiClock size={12} /> {sub.execution_time_ms ?? 0} ms</span>
                                <span style={styles.subMetaDate}>{subDate.split(',')[0]}</span>
                                {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div style={styles.subCardContent}>
                                <div style={styles.subCodeWrapper}>
                                  <pre style={styles.subCodePre}>{sub.code}</pre>
                                </div>
                                {sub.error_message && (
                                  <div style={styles.subErrorMessage}>
                                    <strong>Error Output:</strong>
                                    <pre style={{ margin: '0.25rem 0 0 0', whiteSpace: 'pre-wrap', color: 'var(--color-error)' }}>
                                      {sub.error_message}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* AI Review Panel */
                <div style={styles.submissionsWrapper}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <h3 style={styles.sectionHeading}>AI Code Review</h3>
                    <LoadingButton
                      onClick={handleAIReview}
                      loading={isReviewing}
                      loadingText="Analyzing..."
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '500'
                      }}
                    >
                      Request AI Review
                    </LoadingButton>
                  </div>
                  {isReviewing ? (
                    <div style={styles.loadingContainer}>
                      <div style={styles.spinner}></div>
                      <p style={styles.loadingText}>Our AI Engine is reviewing your code structure, complexities, and potential bugs...</p>
                    </div>
                  ) : aiReview ? (
                    <div>
                      {/* Quality Score Progress Radial */}
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', background: `conic-gradient(var(--accent-primary) ${aiReview.quality_score * 3.6}deg, rgba(255,255,255,0.1) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ position: 'absolute', width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            {aiReview.quality_score}
                          </div>
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>AI Quality Score</h4>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Based on best practices and design principles.</p>
                        </div>
                      </div>

                      {/* Complexity Badges */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Time Complexity</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{aiReview.time_complexity}</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Space Complexity</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{aiReview.space_complexity}</div>
                        </div>
                      </div>

                      {/* Bugs Found */}
                      <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Potential Bugs & Edge Cases</h4>
                      {aiReview.bugs && aiReview.bugs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                          {aiReview.bugs.map((bug, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(231, 76, 60, 0.08)', borderLeft: '3px solid var(--color-error)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                              <FiAlertCircle style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '0.1rem' }} />
                              <span>{bug}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-success)', marginBottom: '1.5rem' }}>✅ No major bugs detected. Great job!</p>
                      )}

                      {/* Optimizations */}
                      <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Optimization Suggestions</h4>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {(aiReview.optimization_tips || []).map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...styles.emptyState, padding: '2rem' }}>
                      <FiCpu size={36} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Click "Request AI Review" to run a complete static code review using our AI Assistant.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Editor + Code Console */}
          <div style={{
            ...styles.rightPanel,
            ...(fullScreen ? {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              backgroundColor: 'var(--bg-primary)'
            } : {})
          }}>
            {/* Header Language Selector */}
            <div style={styles.editorHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
                
                {/* Language Select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FiCode style={{ color: 'var(--accent-primary)' }} />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={styles.langSelect}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="java">Java</option>
                    <option value="go">Go</option>
                  </select>
                </div>

                {/* Theme Select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Theme:</span>
                  <select
                    value={editorTheme}
                    onChange={(e) => setEditorTheme(e.target.value)}
                    style={styles.langSelect}
                  >
                    <option value="vs-dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>

                {/* Font Size Select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Size:</span>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    style={styles.langSelect}
                  >
                    <option value="12">12px</option>
                    <option value="14">14px</option>
                    <option value="16">16px</option>
                    <option value="18">18px</option>
                    <option value="20">20px</option>
                  </select>
                </div>

                {/* Word Wrap Toggle */}
                <button
                  onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    backgroundColor: wordWrap === 'on' ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Wrap: {wordWrap.toUpperCase()}
                </button>

                {/* Full Screen Toggle */}
                <button
                  onClick={() => setFullScreen(!fullScreen)}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.35rem 0.6rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <FiMaximize2 size={12} /> {fullScreen ? 'Exit Full' : 'Full Screen'}
                </button>

              </div>
            </div>

            {/* Monaco Editor Wrapper */}
            <div style={styles.editorWrapper}>
              <Editor
                height="100%"
                language={language === 'c' || language === 'cpp' ? 'cpp' : language}
                theme={editorTheme}
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  fontSize: fontSize,
                  fontFamily: 'Fira Code, Menlo, Monaco, Consolas, Courier New, monospace',
                  minimap: { enabled: false },
                  automaticLayout: true,
                  wordWrap: wordWrap,
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  padding: { top: 12, bottom: 12 },
                  lineNumbers: 'on',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                }}
              />
            </div>

            {/* Bottom Console Panel (Interactive Console Drawer) */}
            <div style={{
              ...styles.consolePanel,
              height: consoleOpen ? '320px' : '0px',
              borderTop: consoleOpen ? '1px solid var(--border-primary)' : 'none'
            }}>
              {/* Drawer Tabs */}
              <div style={styles.consoleHeader}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => setConsoleTab('testcase')}
                    style={consoleTab === 'testcase' ? { ...styles.consoleTabBtn, ...styles.consoleTabBtnActive } : styles.consoleTabBtn}
                  >
                    Testcase
                  </button>
                  <button
                    onClick={() => setConsoleTab('result')}
                    style={consoleTab === 'result' ? { ...styles.consoleTabBtn, ...styles.consoleTabBtnActive } : styles.consoleTabBtn}
                  >
                    Result
                  </button>
                </div>
                <button 
                  onClick={() => setConsoleOpen(false)}
                  style={styles.collapseBtn}
                >
                  <FiChevronDown size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={styles.consoleContent}>
                {consoleTab === 'testcase' ? (
                  /* Testcase Tab */
                  <div style={styles.testcaseTabContent}>
                    <p style={styles.consoleHelpText}>Run your code against these sample input testcases:</p>
                    <div style={styles.testcaseGrid}>
                      {selectedProblem.test_cases?.filter(tc => !tc.is_hidden).map((tc, idx) => (
                        <button
                          key={tc.id || idx}
                          onClick={() => setActiveCaseIndex(idx)}
                          style={{
                            ...styles.caseTabBtn,
                            backgroundColor: activeCaseIndex === idx ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: activeCaseIndex === idx ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: activeCaseIndex === idx ? 'bold' : 'normal',
                          }}
                        >
                          Case {idx + 1}
                        </button>
                      ))}
                    </div>

                    {selectedProblem.test_cases?.filter(tc => !tc.is_hidden)[activeCaseIndex] && (
                      <div style={styles.caseIOBox}>
                        <div style={styles.ioField}>
                          <span style={styles.ioLabel}>Input:</span>
                          <pre style={styles.ioPre}>{selectedProblem.test_cases.filter(tc => !tc.is_hidden)[activeCaseIndex].input_data}</pre>
                        </div>
                        <div style={styles.ioField}>
                          <span style={styles.ioLabel}>Expected Output:</span>
                          <pre style={styles.ioPre}>{selectedProblem.test_cases.filter(tc => !tc.is_hidden)[activeCaseIndex].expected_output}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Result Tab */
                  <div style={styles.resultTabContent}>
                    {isRunning || isSubmitting ? (
                      <div style={styles.resultLoading}>
                        <div style={styles.spinner}></div>
                        <p style={{ marginTop: '0.75rem', color: 'var(--accent-primary)' }}>
                          {isRunning ? 'Running your code against sample test cases...' : 'Submitting your solution to sandbox environment...'}
                        </p>
                      </div>
                    ) : !results ? (
                      <div style={styles.resultEmpty}>
                        <FiTerminal size={36} />
                        <p style={{ marginTop: '0.5rem' }}>Run or Submit your code to see results.</p>
                      </div>
                    ) : (
                      /* Display run/submit output results */
                      <div style={styles.resultWrapper}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div>
                            <span style={{
                              ...styles.statusText,
                              color: results.status.toLowerCase() === 'accepted' ? 'var(--color-success)' : 'var(--color-error)'
                            }}>
                              {results.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style={styles.passedText}>
                              {results.type === 'run' ? 'Sample Testcases:' : 'Full Evaluation:'} Passed {results.passed} / {results.total}
                            </span>
                          </div>
                          {results.execution_time_ms !== undefined && (
                            <span style={styles.runtimeBadge}>
                              Runtime: {results.execution_time_ms} ms
                            </span>
                          )}
                        </div>

                        {results.error_message && (
                          <div style={styles.errorConsole}>
                            <h4 style={styles.errorConsoleTitle}>Stdout / Traceback Error:</h4>
                            <pre style={styles.errorConsoleContent}>{results.error_message}</pre>
                          </div>
                        )}

                        {/* Test Cases Results Detail */}
                        {results.test_results && results.test_results.length > 0 && (
                          <div>
                            <div style={styles.caseTabRow}>
                              {results.test_results.map((tc, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setActiveCaseIndex(idx)}
                                  style={{
                                    ...styles.caseTabBtn,
                                    color: tc.passed ? 'var(--color-success)' : 'var(--color-error)',
                                    fontWeight: activeCaseIndex === idx ? 'bold' : 'normal',
                                    borderBottom: activeCaseIndex === idx ? `2px solid ${tc.passed ? 'var(--color-success)' : 'var(--color-error)'}` : 'none'
                                  }}
                                >
                                  Case {idx + 1} {tc.passed ? <FiCheck size={10} /> : <FiX size={10} />}
                                </button>
                              ))}
                            </div>

                            {results.test_results[activeCaseIndex] && (
                              <div style={styles.caseIOBox}>
                                <div style={styles.ioField}>
                                  <span style={styles.ioLabel}>Input:</span>
                                  <pre style={styles.ioPre}>{results.test_results[activeCaseIndex].input_data}</pre>
                                </div>
                                <div style={styles.ioField}>
                                  <span style={styles.ioLabel}>Expected Output:</span>
                                  <pre style={styles.ioPre}>{results.test_results[activeCaseIndex].expected_output}</pre>
                                </div>
                                <div style={styles.ioField}>
                                  <span style={{
                                    ...styles.ioLabel,
                                    color: results.test_results[activeCaseIndex].passed ? 'var(--color-success)' : 'var(--color-error)'
                                  }}>Actual Output:</span>
                                  <pre style={{
                                    ...styles.ioPre,
                                    border: results.test_results[activeCaseIndex].passed ? '1px solid rgba(46, 204, 113, 0.2)' : '1px solid rgba(231, 76, 60, 0.2)'
                                  }}>{results.test_results[activeCaseIndex].actual_output || '(Empty)'}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Editor Action Control Bar */}
            <div style={styles.editorFooter}>
              <button 
                onClick={() => setConsoleOpen(!consoleOpen)}
                style={styles.consoleToggleBtn}
              >
                Console {consoleOpen ? <FiChevronDown /> : <FiChevronUp />}
              </button>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <LoadingButton
                  onClick={handleRun}
                  loading={isRunning}
                  loadingText="Running..."
                  disabled={isSubmitting}
                  style={styles.runBtn}
                >
                  <FiPlay /> Run
                </LoadingButton>
                <LoadingButton
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  loadingText="Submitting..."
                  disabled={isRunning}
                  style={styles.submitBtn}
                >
                  <FiCheck /> Submit
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.emptyState}>
          <FiAlertCircle size={48} />
          <h3>No Coding Problems</h3>
          <p>Ask your instructor to add programming exercises to this course syllabus.</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: 'calc(100vh - var(--navbar-height))',
    backgroundColor: '#121212',
    color: '#E0E0E0',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    gap: '1rem',
    backgroundColor: '#121212',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTop: '3px solid var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#888',
    fontSize: '0.875rem',
  },
  problemsSidebar: {
    width: '260px',
    borderRight: '1px solid #2A2A2A',
    backgroundColor: '#1E1E1E',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarTitle: {
    padding: '1.25rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#FFF',
    borderBottom: '1px solid #2A2A2A',
  },
  problemsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  problemItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.875rem 1.25rem',
    borderBottom: '1px solid #2A2A2A',
    textDecoration: 'none',
    transition: 'background-color 0.2s',
  },
  problemItemSelected: {
    backgroundColor: '#2A2A2A',
  },
  problemTitle: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#E0E0E0',
  },
  diffBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sandboxArea: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  leftPanel: {
    flex: 1,
    borderRight: '1px solid #2A2A2A',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1E1E1E',
    overflow: 'hidden',
  },
  leftTabHeader: {
    display: 'flex',
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #2A2A2A',
    padding: '0 0.5rem',
  },
  leftTabBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#888',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  leftTabBtnActive: {
    color: '#FFF',
    borderBottom: '2px solid var(--accent-primary)',
  },
  leftTabContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
  },
  descriptionWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: '600',
    color: '#FFF',
    margin: 0,
  },
  difficultyBadge: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontWeight: '700',
  },
  descContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  descText: {
    fontSize: '0.875rem',
    color: '#C0C0C0',
    lineHeight: '1.6',
    margin: 0,
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionHeading: {
    fontSize: '0.9375rem',
    fontWeight: '600',
    color: '#FFF',
    borderBottom: '1px solid #2A2A2A',
    paddingBottom: '0.375rem',
    margin: 0,
  },
  constraintsBlock: {
    backgroundColor: '#151515',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: '#E0E0E0',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  exampleBlock: {
    backgroundColor: '#151515',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.5rem',
  },
  exampleTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#FFF',
    margin: '0 0 0.5rem 0',
  },
  exampleContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  exampleLabel: {
    fontSize: '0.75rem',
    color: '#888',
    fontWeight: '500',
  },
  examplePre: {
    backgroundColor: 'transparent',
    color: '#C0C0C0',
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    margin: '0.125rem 0 0 0',
    padding: 0,
    border: 'none',
  },
  submissionsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  submissionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  subCard: {
    backgroundColor: '#1A1A1A',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  subCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.875rem 1.25rem',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.2s',
  },
  subStatusBadge: {
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  subLang: {
    fontSize: '0.75rem',
    color: '#888',
    backgroundColor: '#2A2A2A',
    padding: '0.125rem 0.375rem',
    borderRadius: '3px',
    textTransform: 'uppercase',
  },
  subMeta: {
    fontSize: '0.75rem',
    color: '#888',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  subMetaDate: {
    fontSize: '0.75rem',
    color: '#666',
  },
  subCardContent: {
    padding: '1.25rem',
    borderTop: '1px solid #2A2A2A',
    backgroundColor: '#151515',
  },
  subCodeWrapper: {
    backgroundColor: '#0F0F0F',
    border: '1px solid #222',
    borderRadius: '4px',
    padding: '1rem',
    overflowX: 'auto',
  },
  subCodePre: {
    margin: 0,
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: '#C0C0C0',
  },
  subErrorMessage: {
    marginTop: '0.75rem',
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '4px',
    padding: '0.75rem 1rem',
    fontSize: '0.8125rem',
  },
  rightPanel: {
    flex: 1.2,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#151515',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.625rem 1.25rem',
    borderBottom: '1px solid #2A2A2A',
    backgroundColor: '#1E1E1E',
  },
  langSelect: {
    padding: '0.25rem 0.5rem',
    backgroundColor: '#2A2A2A',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#FFF',
    fontSize: '0.8125rem',
    outline: 'none',
    cursor: 'pointer',
  },
  editorWrapper: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  consolePanel: {
    backgroundColor: '#1A1A1A',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'height 0.25s ease-out',
  },
  consoleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderBottom: '1px solid #2A2A2A',
    padding: '0 1rem',
  },
  consoleTabBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#888',
    padding: '0.625rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  consoleTabBtnActive: {
    color: '#FFF',
    borderBottom: '2px solid #FFF',
  },
  collapseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  consoleContent: {
    flex: 1,
    padding: '1.25rem',
    overflowY: 'auto',
  },
  consoleHelpText: {
    fontSize: '0.75rem',
    color: '#888',
    margin: '0 0 0.75rem 0',
  },
  testcaseTabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  testcaseGrid: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  caseTabBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    padding: '0.375rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  caseIOBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
    backgroundColor: '#141414',
    padding: '1rem',
    borderRadius: '6px',
    border: '1px solid #252525',
  },
  ioField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  ioLabel: {
    fontSize: '0.75rem',
    color: '#888',
    fontWeight: '500',
  },
  ioPre: {
    backgroundColor: '#202020',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: '#FFF',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  resultTabContent: {
    height: '100%',
  },
  resultLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '150px',
  },
  resultEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '150px',
    color: '#666',
    fontSize: '0.875rem',
  },
  resultWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  statusText: {
    fontSize: '1.125rem',
    fontWeight: '700',
  },
  passedText: {
    fontSize: '0.875rem',
    color: '#888',
    marginLeft: '1rem',
  },
  runtimeBadge: {
    fontSize: '0.75rem',
    color: '#C0C0C0',
    backgroundColor: '#2A2A2A',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
  },
  errorConsole: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '6px',
    padding: '1rem',
  },
  errorConsoleTitle: {
    color: 'var(--color-error)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    margin: '0 0 0.5rem 0',
  },
  errorConsoleContent: {
    margin: 0,
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: '#E0E0E0',
    whiteSpace: 'pre-wrap',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  caseTabRow: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid #2A2A2A',
    marginBottom: '0.75rem',
    paddingBottom: '0.25rem',
  },
  editorFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 1.25rem',
    borderTop: '1px solid #2A2A2A',
    backgroundColor: '#1E1E1E',
  },
  consoleToggleBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontWeight: '500',
  },
  runBtn: {
    backgroundColor: '#2A2A2A',
    border: '1px solid #3A3A3A',
    color: '#FFF',
    fontWeight: '600',
    padding: '0.375rem 1rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    transition: 'background-color 0.2s',
  },
  submitBtn: {
    backgroundColor: 'var(--color-success)',
    border: 'none',
    color: '#FFF',
    fontWeight: '600',
    padding: '0.375rem 1rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    transition: 'opacity 0.2s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    flex: 1,
    textAlign: 'center',
    color: '#666',
  },
};
