import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiCode, FiCpu, FiPlay, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';

export default function CodingPractice() {
  const { slug } = useParams();
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [results, setResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Default starter codes if backend doesn't provide them
  const starterCode = {
    python: 'def solve():\n    # Write your Python code here\n    pass\n',
    javascript: 'function solve() {\n    // Write your JavaScript code here\n}\n',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    return 0;\n}\n',
    java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java code here\n    }\n}\n'
  };

  // Fetch coding problems
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
    if (language === 'java') setCode(selectedProblem.starter_code_java || starterCode.java);
  }, [language, selectedProblem]);

  const handleRun = async () => {
    if (!selectedProblem) return;
    setIsRunning(true);
    setResults(null);
    try {
      const res = await api.post(`/coding/problems/${selectedProblem.id}/run`, {
        language,
        code
      });
      setResults(res.data);
      toast.success('Code executed against sample test cases!');
    } catch (err) {
      toast.error('Error running code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProblem) return;
    setIsSubmitting(true);
    setResults(null);
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
        error_message: res.data.error_message
      });
      if (isAccepted) {
        toast.success('Congratulations! All test cases passed.');
      } else {
        toast.error(`Submission failed: ${(res.data.status || 'failed').replace('_', ' ').toLowerCase()}`);
      }
    } catch (err) {
      toast.error('Error submitting code');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Configuring practice sandbox...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
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
                style={isSelected ? { ...styles.problemItem, ...styles.problemItemSelected } : styles.problemItem}
              >
                <span style={styles.problemTitle}>{p.title}</span>
                <span style={{
                  ...styles.diffBadge,
                  color: p.difficulty === 'easy' ? 'var(--color-success)' : p.difficulty === 'medium' ? 'var(--color-warning)' : 'var(--color-error)'
                }}>{p.difficulty}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Sandbox Area */}
      {selectedProblem ? (
        <div style={styles.sandboxArea}>
          {/* Question panel */}
          <div style={styles.questionPanel}>
            <div style={styles.questionHeader}>
              <h1 style={styles.title}>{selectedProblem.title}</h1>
              <span style={{
                ...styles.difficultyBadge,
                backgroundColor: selectedProblem.difficulty === 'easy' ? 'rgba(46, 204, 113, 0.1)' : selectedProblem.difficulty === 'medium' ? 'rgba(243, 156, 18, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                color: selectedProblem.difficulty === 'easy' ? 'var(--color-success)' : selectedProblem.difficulty === 'medium' ? 'var(--color-warning)' : 'var(--color-error)'
              }}>{selectedProblem.difficulty.toUpperCase()}</span>
            </div>

            <div style={styles.descContent}>
              <p style={styles.descText}>{selectedProblem.description}</p>

              {selectedProblem.input_format && (
                <>
                  <h4 style={styles.sectionHeading}>Input Format</h4>
                  <p style={styles.descText}>{selectedProblem.input_format}</p>
                </>
              )}

              {selectedProblem.output_format && (
                <>
                  <h4 style={styles.sectionHeading}>Output Format</h4>
                  <p style={styles.descText}>{selectedProblem.output_format}</p>
                </>
              )}

              {selectedProblem.constraints && (
                <>
                  <h4 style={styles.sectionHeading}>Constraints</h4>
                  <pre style={styles.constraintsBlock}>{selectedProblem.constraints}</pre>
                </>
              )}
            </div>
          </div>

          {/* Code editor & execution output panel */}
          <div style={styles.editorPanel}>
            <div style={styles.editorHeader}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={styles.langSelect}
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>

              <div style={styles.editorActions}>
                <button
                  onClick={handleRun}
                  disabled={isRunning || isSubmitting}
                  style={styles.runBtn}
                >
                  <FiPlay /> Run
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isRunning || isSubmitting}
                  style={styles.submitBtn}
                >
                  <FiCheck /> Submit
                </button>
              </div>
            </div>

            <div style={styles.editorWrapper}>
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language === 'java' ? 'java' : language}
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value || '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>

            {/* Results Console Panel */}
            <div style={styles.consolePanel}>
              <h3 style={styles.consoleTitle}>Test Results</h3>
              <div style={styles.consoleContent}>
                {!results && !isRunning && !isSubmitting && (
                  <p style={styles.consolePlaceholder}>Run or Submit your code to see the evaluation output.</p>
                )}

                {(isRunning || isSubmitting) && (
                  <p style={styles.consoleLoading}>Executing test suites against environment sandbox...</p>
                )}

                {results && (
                  <div style={styles.resultsWrapper}>
                    <div style={styles.resultsSummary}>
                      <span style={results.status === 'ACCEPTED' || results.status === 'accepted' ? styles.successText : styles.errorText}>
                        {(results.status || '').toUpperCase().replace('_', ' ')}
                      </span>
                      <span style={styles.passedText}>
                        Passed: {results.passed} / {results.total}
                      </span>
                    </div>

                    {results.error_message && (
                      <div style={styles.errorConsole}>
                        <h4 style={styles.errorConsoleTitle}>Error Output:</h4>
                        <pre style={styles.errorConsoleContent}>{results.error_message}</pre>
                      </div>
                    )}

                    <div style={styles.casesList}>
                      {results.test_results?.map((tc, idx) => (
                        <div key={idx} style={styles.caseCard}>
                          <div style={styles.caseHeader}>
                            <span>Test Case {idx + 1}</span>
                            {tc.passed ? (
                              <span style={styles.casePass}><FiCheck /> Pass</span>
                            ) : (
                              <span style={styles.caseFail}><FiX /> Fail</span>
                            )}
                          </div>
                          <div style={styles.caseDetails}>
                            <div>
                              <span style={styles.detailLbl}>Input</span>
                              <pre style={styles.detailPre}>{tc.input_data}</pre>
                            </div>
                            <div>
                              <span style={styles.detailLbl}>Expected</span>
                              <pre style={styles.detailPre}>{tc.expected_output}</pre>
                            </div>
                            {tc.actual_output !== undefined && (
                              <div>
                                <span style={styles.detailLbl}>Output</span>
                                <pre style={styles.detailPre}>{tc.actual_output || '(Empty)'}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  problemsSidebar: {
    width: '260px',
    borderRight: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarTitle: {
    padding: '1.25rem',
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-semibold)',
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
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border-primary)',
  },
  problemItemSelected: {
    backgroundColor: 'var(--bg-card)',
  },
  problemTitle: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-primary)',
  },
  diffBadge: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    textTransform: 'capitalize',
  },
  sandboxArea: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  questionPanel: {
    flex: 1,
    borderRight: '1px solid var(--border-primary)',
    padding: '2rem',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-semibold)',
  },
  difficultyBadge: {
    fontSize: '0.75rem',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-bold)',
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
  },
  sectionHeading: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.25rem',
  },
  constraintsBlock: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
  },
  editorPanel: {
    flex: 1.2,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
  },
  langSelect: {
    padding: '0.375rem 0.75rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  editorActions: {
    display: 'flex',
    gap: '0.75rem',
  },
  runBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.375rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.375rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  editorWrapper: {
    flex: 1.5,
    borderBottom: '1px solid var(--border-primary)',
  },
  consolePanel: {
    flex: 1,
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  consoleTitle: {
    padding: '0.75rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    borderBottom: '1px solid var(--border-primary)',
  },
  consoleContent: {
    flex: 1,
    padding: '1.25rem',
    overflowY: 'auto',
  },
  consolePlaceholder: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  consoleLoading: {
    fontSize: '0.875rem',
    color: 'var(--accent-primary)',
  },
  resultsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  resultsSummary: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
  },
  successText: {
    color: 'var(--color-success)',
  },
  errorText: {
    color: 'var(--color-error)',
  },
  passedText: {
    color: 'var(--text-secondary)',
  },
  casesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  caseCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
  },
  caseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '0.5rem',
  },
  casePass: {
    color: 'var(--color-success)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  caseFail: {
    color: 'var(--color-error)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  caseDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    borderTop: '1px solid var(--border-primary)',
    paddingTop: '0.5rem',
  },
  detailLbl: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  detailPre: {
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.375rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    marginTop: '0.125rem',
    whiteSpace: 'pre-wrap',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    flex: 1,
    textAlign: 'center',
  },
  errorConsole: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    border: '1px solid var(--color-error)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    margin: '0.5rem 0 1rem 0',
  },
  errorConsoleTitle: {
    color: 'var(--color-error)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
    marginTop: 0,
  },
  errorConsoleContent: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    whiteSpace: 'pre-wrap',
    margin: 0,
    overflowX: 'auto',
  },
};
