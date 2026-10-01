import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import PageLoader from '../components/common/PageLoader';
import { useTheme } from '../context/ThemeContext';
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
  FiChevronLeft,
  FiChevronRight,
  FiShuffle,
  FiBookOpen, 
  FiDatabase,
  FiCpu,
  FiStar,
  FiMaximize2,
  FiRotateCcw,
  FiCopy,
  FiPlayCircle,
  FiSliders
} from 'react-icons/fi';


export default function CodingPractice() {
  const { slug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) {
      navigate('/coding', { replace: true });
    }
  }, [slug, navigate]);

  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  
  // Monaco configurations
  const { theme: appTheme } = useTheme();
  const [editorTheme, setEditorTheme] = useState(() => (appTheme === 'light' ? 'light' : 'vs-dark'));
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState('on');
  const [fullScreen, setFullScreen] = useState(false);
  
  // Layout states
  const [leftTab, setLeftTab] = useState('description'); // 'description' | 'submissions' | 'ai'
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleTab, setConsoleTab] = useState('testcase'); // 'testcase' | 'custom' | 'result'
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);

  // Flexible Splitter Resizers
  const sandboxAreaRef = useRef(null);
  const rightPanelRef = useRef(null);
  const [leftPanelWidthPercent, setLeftPanelWidthPercent] = useState(() => {
    const saved = localStorage.getItem('codexia_coding_split_h');
    return saved ? parseFloat(saved) : 45;
  });
  const [isDraggingH, setIsDraggingH] = useState(false);

  const [consoleHeight, setConsoleHeight] = useState(() => {
    const saved = localStorage.getItem('codexia_coding_console_h');
    return saved ? parseInt(saved, 10) : 300;
  });
  const [isDraggingV, setIsDraggingV] = useState(false);
  
  // Custom Input Testcase
  const [customInput, setCustomInput] = useState('');
  const [customResult, setCustomResult] = useState(null);
  const [isRunningCustom, setIsRunningCustom] = useState(false);
  
  // Data states
  const [submissions, setSubmissions] = useState([]);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
  const [results, setResults] = useState(null);
  const [isFav, setIsFav] = useState(false);
  const [isProblemSolved, setIsProblemSolved] = useState(false);
  const [aiReview, setAiReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(false);

  // Default starter codes
  const starterCode = {
    python: 'def solve():\\n    # Write your Python code here\\n    pass\\n',
    javascript: 'function solve() {\\n    // Write your JavaScript code here\\n}\\n',
    cpp: '#include <iostream>\\nusing namespace std;\\n\\nint main() {\\n    // Write your C++ code here\\n    return 0;\\n}\\n',
    c: '#include <stdio.h>\\n\\nint main() {\\n    // Write C code here\\n    return 0;\\n}\\n',
    java: 'public class Solution {\\n    public static void main(String[] args) {\\n        // Write your Java code here\\n    }\\n}\\n',
    go: 'package main\\n\\nimport "fmt"\\n\\nfunc main() {\\n    // Write Go code here\\n}\\n'
  };

  const getStarterCode = (problem, lang) => {
    if (!problem) return starterCode[lang] || '';
    if (lang === 'python') return problem.starter_code_python || starterCode.python;
    if (lang === 'javascript') return problem.starter_code_javascript || starterCode.javascript;
    if (lang === 'cpp') return problem.starter_code_cpp || starterCode.cpp;
    if (lang === 'c') return problem.starter_code_c || starterCode.c;
    if (lang === 'java') return problem.starter_code_java || starterCode.java;
    if (lang === 'go') return problem.starter_code_go || starterCode.go;
    return starterCode.python;
  };

  // Fetch coding problems list and problem details
  useEffect(() => {
    async function loadProblems() {
      setIsLoading(true);
      let items = [];
      try {
        const res = await api.get('/coding/problems?page_size=100');
        items = res.data?.items || (Array.isArray(res.data) ? res.data : []);
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
          setCode(getStarterCode(detailRes.data, language));

          const matchingInList = items.find(p => p.id === detailRes.data.id || p.slug === activeSlug);
          setIsProblemSolved(Boolean(detailRes.data.is_solved || matchingInList?.is_solved));
          
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
    setCode(getStarterCode(selectedProblem, language));
  }, [language]);

  const currentProblemIndex = problems.findIndex(p => p.slug === slug || p.id === selectedProblem?.id);

  const handlePrevProblem = () => {
    if (currentProblemIndex > 0) {
      navigate(`/coding/${problems[currentProblemIndex - 1].slug}`);
    }
  };

  const handleNextProblem = () => {
    if (currentProblemIndex < problems.length - 1) {
      navigate(`/coding/${problems[currentProblemIndex + 1].slug}`);
    }
  };

  const handlePickRandomWorkspace = async () => {
    try {
      const res = await api.get('/coding/problems/random');
      if (res.data?.slug) {
        navigate(`/coding/${res.data.slug}`);
      }
    } catch (e) {
      if (problems.length > 0) {
        const r = problems[Math.floor(Math.random() * problems.length)];
        navigate(`/coding/${r.slug}`);
      }
    }
  };

  // Global Keyboard Shortcuts (Ctrl+Enter to Run, Ctrl+Shift+Enter to Submit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSubmit();
        } else {
          handleRun();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        setConsoleOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, language, selectedProblem, customInput]);

  // Horizontal Resizer Drag Effect (Left Panel vs Right Panel)
  useEffect(() => {
    if (!isDraggingH) return;
    const handleMouseMove = (e) => {
      if (!sandboxAreaRef.current) return;
      const rect = sandboxAreaRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(newWidth, 20), 80);
      setLeftPanelWidthPercent(clamped);
      localStorage.setItem('codexia_coding_split_h', clamped.toFixed(2));
    };
    const handleMouseUp = () => {
      setIsDraggingH(false);
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingH]);

  // Vertical Resizer Drag Effect (Editor vs Console)
  useEffect(() => {
    if (!isDraggingV) return;
    const handleMouseMove = (e) => {
      if (!rightPanelRef.current) return;
      const rect = rightPanelRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      const maxHeight = Math.max(rect.height - 100, 150);
      const clamped = Math.min(Math.max(newHeight, 100), maxHeight);
      setConsoleHeight(clamped);
      localStorage.setItem('codexia_coding_console_h', clamped.toString());
    };
    const handleMouseUp = () => {
      setIsDraggingV(false);
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingV]);

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
      setSubmissions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Failed to load submissions');
    } finally {
      setIsSubmissionsLoading(false);
    }
  };

  const handleResetCode = () => {
    if (window.confirm('Reset code to initial boilerplate template? Your current edits will be cleared.')) {
      setCode(getStarterCode(selectedProblem, language));
      toast.success('Code reset to default starter template');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const handleRun = async () => {
    if (!selectedProblem) return;
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
      const errDetail = err.response?.data?.detail || err.message || 'Error running code';
      toast.error(errDetail);
      setResults({
        status: 'Runtime Error',
        passed: 0,
        total: selectedProblem.test_cases?.filter(tc => !tc.is_hidden).length || 0,
        test_results: [],
        error_message: errDetail,
        type: 'run'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCustomRun = async () => {
    if (!selectedProblem) return;
    setIsRunningCustom(true);
    setConsoleOpen(true);
    setConsoleTab('custom');
    try {
      const res = await api.post(`/coding/problems/${selectedProblem.id}/custom-run`, {
        code,
        language,
        custom_input: customInput
      });
      setCustomResult(res.data);
      if (res.data.status === 'completed') {
        toast.success('Custom test executed successfully!');
      } else {
        toast.error('Execution encountered an error');
      }
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.message || 'Execution failed';
      toast.error(errDetail);
      setCustomResult({
        status: 'error',
        input_data: customInput,
        actual_output: '',
        error_message: errDetail,
        execution_time_ms: 0,
        memory_used_mb: 0
      });
    } finally {
      setIsRunningCustom(false);
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
        test_results: [],
        error_message: res.data.error_message,
        execution_time_ms: res.data.execution_time_ms,
        type: 'submit'
      });
      if (isAccepted) {
        setIsProblemSolved(true);
        toast.success('Congratulations! All test cases passed.');
        if (leftTab === 'submissions') loadSubmissions();
      } else {
        toast.error(`Submission failed: ${(res.data.status || 'failed').replace('_', ' ').toLowerCase()}`);
      }
    } catch (err) {
      const errDetail = err.response?.data?.detail || err.message || 'Error submitting code';
      toast.error(errDetail);
      setResults({
        status: 'Submission Failed',
        passed: 0,
        total: selectedProblem.test_cases?.length || 0,
        test_results: [],
        error_message: errDetail,
        type: 'submit'
      });
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
    return <PageLoader />;
  }

  return (
    <div style={styles.workspaceWrapper}>
      {/* Top Workspace Bar (LeetCode Style) */}
      <div style={styles.topWorkspaceBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/coding" style={styles.backLink}>
            <FiChevronLeft size={16} />
            <span>Problem List</span>
          </Link>
          <div style={styles.topNavDivider} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <button
              onClick={handlePrevProblem}
              disabled={currentProblemIndex <= 0}
              style={styles.navSquareBtn}
              title="Previous problem"
            >
              <FiChevronLeft size={15} />
            </button>
            <button
              onClick={handleNextProblem}
              disabled={currentProblemIndex >= problems.length - 1}
              style={styles.navSquareBtn}
              title="Next problem"
            >
              <FiChevronRight size={15} />
            </button>
            <button
              onClick={handlePickRandomWorkspace}
              style={styles.navSquareBtn}
              title="Pick random problem"
            >
              <FiShuffle size={14} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleFav}
            style={isFav ? styles.topFavBtnActive : styles.topFavBtn}
            title={isFav ? 'Starred' : 'Star problem'}
          >
            <FiStar size={14} fill={isFav ? 'var(--color-warning)' : 'none'} color="var(--color-warning)" />
            <span>{isFav ? 'Starred' : 'Star'}</span>
          </button>
        </div>
      </div>

      <div style={styles.container}>
        <style>{`
          /* Custom scrollbar */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: var(--bg-tertiary);
          }
          ::-webkit-scrollbar-thumb {
            background: var(--border-primary);
            border-radius: 3px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
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
            background-color: var(--border-primary) !important;
          }
          .action-icon {
            transition: transform 0.2s ease;
          }
          .action-icon:hover {
            transform: scale(1.1);
          }
          .gutter-resizer-h:hover {
            background-color: var(--accent-primary) !important;
          }
          .gutter-resizer-v:hover {
            background-color: var(--accent-primary) !important;
          }
        `}</style>




      {/* Main Sandbox Area */}
      {selectedProblem ? (
        <div ref={sandboxAreaRef} style={styles.sandboxArea}>
          
          {/* Left panel: Description / Submissions */}
          <div style={{
            ...styles.leftPanel,
            width: `${leftPanelWidthPercent}%`,
            flex: 'none'
          }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <h1 style={styles.title}>
                        {currentProblemIndex >= 0 ? `${currentProblemIndex + 1}. ` : `${selectedProblem.id}. `}
                        {selectedProblem.title}
                      </h1>
                      <button
                        onClick={toggleFav}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: isFav ? 'var(--color-warning)' : 'var(--text-secondary)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Add to Favorites"
                      >
                        <FiStar size={20} fill={isFav ? 'var(--color-warning)' : 'none'} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{
                        ...styles.difficultyBadge,
                        backgroundColor: selectedProblem.difficulty.toLowerCase() === 'easy' ? 'var(--color-success-bg)' : selectedProblem.difficulty.toLowerCase() === 'medium' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
                        color: selectedProblem.difficulty.toLowerCase() === 'easy' ? 'var(--color-success)' : selectedProblem.difficulty.toLowerCase() === 'medium' ? 'var(--color-warning)' : 'var(--color-error)'
                      }}>{selectedProblem.difficulty.toUpperCase()}</span>

                      {isProblemSolved && (
                        <span style={styles.solvedBadgeHeader}>
                          <FiCheck size={13} strokeWidth={2.5} /> Solved
                        </span>
                      )}
                    </div>
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
                        backgroundColor: 'var(--primary)',
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
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--border-secondary)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', background: `conic-gradient(var(--accent-primary) ${aiReview.quality_score * 3.6}deg, var(--border-primary) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        <div style={{ flex: 1, backgroundColor: 'var(--border-secondary)', border: '1px solid var(--border-primary)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Time Complexity</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{aiReview.time_complexity}</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: 'var(--border-secondary)', border: '1px solid var(--border-primary)', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Space Complexity</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{aiReview.space_complexity}</div>
                        </div>
                      </div>

                      {/* Bugs Found */}
                      <h4 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Potential Bugs & Edge Cases</h4>
                      {aiReview.bugs && aiReview.bugs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                          {aiReview.bugs.map((bug, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--color-error-bg)', borderLeft: '3px solid var(--color-error)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
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

          {/* Horizontal Resizer Gutter between Left and Right Panel */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingH(true);
            }}
            className="gutter-resizer-h"
            style={{
              width: '8px',
              cursor: 'col-resize',
              backgroundColor: isDraggingH ? 'var(--accent-primary)' : 'var(--bg-card)',
              borderLeft: '1px solid var(--border-primary)',
              borderRight: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 10,
              userSelect: 'none',
              transition: isDraggingH ? 'none' : 'background-color 0.15s ease'
            }}
            title="Drag to resize Question and Code Editor panels"
          >
            <div style={{
              width: '2px',
              height: '24px',
              borderRadius: '1px',
              backgroundColor: isDraggingH ? '#FFF' : 'var(--border-light)'
            }} />
          </div>

          {/* Right panel: Editor + Code Console */}
          <div 
            ref={rightPanelRef}
            style={{
              ...styles.rightPanel,
              width: `${100 - leftPanelWidthPercent}%`,
              flex: 1,
              ...(fullScreen ? {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                backgroundColor: 'var(--bg-primary)'
              } : {})
            }}
          >
            {/* Header Controls */}
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
                    <option value="python">Python 3</option>
                    <option value="javascript">JavaScript (Node.js)</option>
                    <option value="cpp">C++ (G++)</option>
                    <option value="c">C (GCC)</option>
                    <option value="java">Java (OpenJDK)</option>
                    <option value="go">Go</option>
                  </select>
                </div>

                {/* Theme Select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Theme:</span>
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
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Size:</span>
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

                {/* Reset Code Button */}
                <button
                  onClick={handleResetCode}
                  style={{
                    padding: '0.35rem 0.6rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  title="Reset to starter boilerplate"
                >
                  <FiRotateCcw size={12} /> Reset
                </button>

                {/* Copy Code Button */}
                <button
                  onClick={handleCopyCode}
                  style={{
                    padding: '0.35rem 0.6rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  title="Copy code to clipboard"
                >
                  <FiCopy size={12} /> Copy
                </button>

                {/* Word Wrap Toggle */}
                <button
                  onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
                  style={{
                    padding: '0.35rem 0.6rem',
                    backgroundColor: wordWrap === 'on' ? 'var(--border-primary)' : 'transparent',
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
            <div style={{
              ...styles.editorWrapper,
              pointerEvents: (isDraggingH || isDraggingV) ? 'none' : 'auto'
            }}>
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

            {/* Vertical Resizer Gutter between Editor and Console */}
            {consoleOpen && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingV(true);
                }}
                className="gutter-resizer-v"
                style={{
                  height: '8px',
                  cursor: 'row-resize',
                  backgroundColor: isDraggingV ? 'var(--accent-primary)' : 'var(--bg-card)',
                  borderTop: '1px solid var(--border-primary)',
                  borderBottom: '1px solid var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 10,
                  userSelect: 'none',
                  transition: isDraggingV ? 'none' : 'background-color 0.15s ease'
                }}
                title="Drag to resize Editor and Console"
              >
                <div style={{
                  height: '2px',
                  width: '28px',
                  borderRadius: '1px',
                  backgroundColor: isDraggingV ? '#FFF' : 'var(--border-light)'
                }} />
              </div>
            )}

            {/* Bottom Console Panel (Interactive Console Drawer) */}
            <div style={{
              ...styles.consolePanel,
              display: consoleOpen ? 'flex' : 'none',
              height: `${consoleHeight}px`,
              minHeight: '100px',
              maxHeight: 'none',
              flexShrink: 0,
              borderTop: consoleOpen ? 'none' : '1px solid var(--border-primary)',
              transition: isDraggingV ? 'none' : 'height 0.2s ease-out'
            }}>
              {/* Drawer Tabs */}
              <div style={styles.consoleHeader}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setConsoleTab('testcase')}
                    style={consoleTab === 'testcase' ? { ...styles.consoleTabBtn, ...styles.consoleTabBtnActive } : styles.consoleTabBtn}
                  >
                    Testcases
                  </button>
                  <button
                    onClick={() => setConsoleTab('custom')}
                    style={consoleTab === 'custom' ? { ...styles.consoleTabBtn, ...styles.consoleTabBtnActive } : styles.consoleTabBtn}
                  >
                    Custom Input
                  </button>
                  <button
                    onClick={() => setConsoleTab('result')}
                    style={consoleTab === 'result' ? { ...styles.consoleTabBtn, ...styles.consoleTabBtnActive } : styles.consoleTabBtn}
                  >
                    Test Result
                  </button>
                </div>
                <button 
                  onClick={() => setConsoleOpen(false)}
                  style={styles.collapseBtn}
                  title="Collapse console"
                >
                  <FiChevronDown size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={styles.consoleContent}>
                {consoleTab === 'testcase' ? (
                  /* Testcase Tab */
                  <div style={styles.testcaseTabContent}>
                    <p style={styles.consoleHelpText}>Run your code against these sample test cases:</p>
                    <div style={styles.testcaseGrid}>
                      {selectedProblem.test_cases?.filter(tc => !tc.is_hidden).map((tc, idx) => (
                        <button
                          key={tc.id || idx}
                          onClick={() => setActiveCaseIndex(idx)}
                          style={{
                            ...styles.caseTabBtn,
                            backgroundColor: activeCaseIndex === idx ? 'var(--border-primary)' : 'transparent',
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
                ) : consoleTab === 'custom' ? (
                  /* Custom Input Tab */
                  <div style={styles.testcaseTabContent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={styles.ioLabel}>Standard Input (stdin):</span>
                      <LoadingButton
                        onClick={handleCustomRun}
                        loading={isRunningCustom}
                        loadingText="Executing..."
                        style={{
                          padding: '0.3rem 0.75rem',
                          backgroundColor: 'var(--primary)',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <FiPlayCircle size={14} /> Run Custom Input
                      </LoadingButton>
                    </div>
                    <textarea
                      placeholder="Enter custom stdin here..."
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      style={{
                        width: '100%',
                        height: '75px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontFamily: 'Fira Code, monospace',
                        fontSize: '0.82rem',
                        padding: '0.5rem',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                        marginBottom: '0.75rem'
                      }}
                    />

                    {customResult && (
                      <div style={styles.caseIOBox}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            ...styles.ioLabel,
                            color: customResult.status === 'completed' ? 'var(--color-success)' : 'var(--color-error)',
                            fontWeight: 'bold'
                          }}>
                            {customResult.status === 'completed' ? 'Execution Output (stdout):' : 'Execution Error:'}
                          </span>
                          <span style={styles.runtimeBadge}>
                            Runtime: {customResult.execution_time_ms} ms · Memory: {customResult.memory_used_mb} MB
                          </span>
                        </div>
                        {customResult.actual_output && (
                          <pre style={{ ...styles.ioPre, color: 'var(--color-success)', marginTop: '0.4rem' }}>{customResult.actual_output}</pre>
                        )}
                        {customResult.error_message && (
                          <pre style={{ ...styles.ioPre, color: 'var(--color-error)', marginTop: '0.4rem' }}>{customResult.error_message}</pre>
                        )}
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
                                    border: results.test_results[activeCaseIndex].passed ? '1px solid var(--color-success-bg)' : '1px solid var(--color-error-bg)'
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
                  disabled={isSubmitting || isRunningCustom}
                  style={styles.runBtn}
                  title="Run Code (Ctrl + Enter)"
                >
                  <FiPlay /> Run
                </LoadingButton>
                <LoadingButton
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  loadingText="Submitting..."
                  disabled={isRunning || isRunningCustom}
                  style={styles.submitBtn}
                  title="Submit Solution (Ctrl + Shift + Enter)"
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
    </div>
  );
}

const styles = {
  workspaceWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    margin: 0,
    padding: 0,
    backgroundColor: 'var(--bg-tertiary)',
    overflow: 'hidden'
  },
  topWorkspaceBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    flexShrink: 0
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--border-primary)',
    transition: 'background-color 0.2s'
  },
  topNavDivider: {
    width: '1px',
    height: '18px',
    backgroundColor: 'var(--border-primary)'
  },
  navToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'var(--border-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer'
  },
  navToggleBtnActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'var(--accent-light)',
    border: '1px solid var(--accent-primary)',
    borderRadius: '4px',
    color: 'var(--accent-primary)',
    padding: '4px 8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  navSquareBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    backgroundColor: 'var(--border-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  activeProblemHeading: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  diffBadgeTop: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
    letterSpacing: '0.3px',
    textTransform: 'capitalize'
  },
  topFavBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    padding: '4px 10px',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer'
  },
  topFavBtnActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'var(--color-warning-bg)',
    border: '1px solid var(--color-warning)',
    borderRadius: '4px',
    color: 'var(--color-warning)',
    padding: '4px 10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  container: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    gap: '1rem',
    backgroundColor: 'var(--bg-tertiary)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border-primary)',
    borderTop: '3px solid var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  },
  problemsSidebar: {
    width: '260px',
    borderRight: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarTitle: {
    padding: '1.25rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-primary)',
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
    borderBottom: '1px solid var(--border-primary)',
    textDecoration: 'none',
    transition: 'background-color 0.2s',
  },
  problemItemSelected: {
    backgroundColor: 'var(--border-primary)',
  },
  problemTitle: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  diffBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sandboxArea: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--bg-tertiary)',
  },
  leftPanel: {
    flex: 1,
    minHeight: 0,
    borderRight: '1px solid var(--border-primary)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-card)',
    overflow: 'hidden',
  },
  leftTabHeader: {
    display: 'flex',
    backgroundColor: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '0 0.5rem',
  },
  leftTabBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  leftTabBtnActive: {
    color: 'var(--text-primary)',
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
    color: 'var(--text-primary)',
    margin: 0,
  },
  difficultyBadge: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontWeight: '700',
  },
  solvedBadgeHeader: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success)',
    letterSpacing: '0.02em',
  },
  descContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  descText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
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
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.375rem',
    margin: 0,
  },
  constraintsBlock: {
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  exampleBlock: {
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.5rem',
  },
  exampleTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
  },
  exampleContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  exampleLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  examplePre: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
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
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
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
    color: 'var(--text-muted)',
    backgroundColor: 'var(--border-primary)',
    padding: '0.125rem 0.375rem',
    borderRadius: '3px',
    textTransform: 'uppercase',
  },
  subMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  subMetaDate: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  subCardContent: {
    padding: '1.25rem',
    borderTop: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-tertiary)',
  },
  subCodeWrapper: {
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    padding: '1rem',
    overflowX: 'auto',
  },
  subCodePre: {
    margin: 0,
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  subErrorMessage: {
    marginTop: '0.75rem',
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
    borderRadius: '4px',
    padding: '0.75rem 1rem',
    fontSize: '0.8125rem',
  },
  rightPanel: {
    flex: 1.2,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-tertiary)',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.625rem 1.25rem',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
  },
  langSelect: {
    padding: '0.25rem 0.5rem',
    backgroundColor: 'var(--border-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    outline: 'none',
    cursor: 'pointer',
  },
  editorWrapper: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'var(--bg-card)',
  },
  consolePanel: {
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'height 0.25s ease-out',
  },
  consoleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '0 1rem',
  },
  consoleTabBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    padding: '0.625rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  consoleTabBtnActive: {
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--primary)',
  },
  collapseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
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
    color: 'var(--text-muted)',
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
    backgroundColor: 'var(--bg-tertiary)',
    padding: '1rem',
    borderRadius: '6px',
    border: '1px solid var(--border-primary)',
  },
  ioField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  ioLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  ioPre: {
    backgroundColor: 'var(--bg-hover)',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
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
    color: 'var(--text-muted)',
    marginLeft: '1rem',
  },
  runtimeBadge: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--border-primary)',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
  },
  errorConsole: {
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
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
    color: 'var(--text-secondary)',
    whiteSpace: 'pre-wrap',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  caseTabRow: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    marginBottom: '0.75rem',
    paddingBottom: '0.25rem',
  },
  editorFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 1.25rem',
    borderTop: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-card)',
    flexShrink: 0,
    zIndex: 10,
  },
  consoleToggleBtn: {
    backgroundColor: 'var(--bg-hover)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontWeight: '500',
    padding: '0.35rem 0.75rem',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  },
  runBtn: {
    backgroundColor: 'var(--border-primary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
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
    backgroundColor: '#059669',
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
    color: 'var(--text-muted)',
  },
};
