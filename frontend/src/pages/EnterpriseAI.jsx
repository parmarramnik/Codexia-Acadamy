import { useCallback, useEffect, useState } from 'react';
import { FiBookOpen, FiCode, FiCpu, FiMessageSquare, FiTerminal } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import MarkdownContent from '../components/common/MarkdownContent';
import TutorChatPanel from '../components/ai/TutorChatPanel';
import CodeCanvas from '../components/ai/CodeCanvas';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import useTutorChat, { describeApiError } from '../hooks/useTutorChat';
import '../styles/ai-workspace.css';

const GREETING = 'Hello! I’m your Study Assistant. Ask me about programming concepts or algorithms, or pick one of your courses and I’ll answer from its material.';
const QUICK_PROMPTS = ['Explain Big-O complexity', 'How does recursion work?', 'REST vs GraphQL APIs', 'Clean code principles'];
const DEBUG_LANGUAGES = [['python', 'Python'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['cpp', 'C++'], ['c', 'C'], ['java', 'Java'], ['go', 'Go']];

const SAMPLE_CODE = `def binary_search(arr, target):
    low = 0
    high = len(arr)  # bug: off by one
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`;

export default function EnterpriseAI() {
  const [activeTab, setActiveTab] = useState('tutor'); // 'tutor' | 'debugger'
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseId, setCourseId] = useState(null);
  const [canvas, setCanvas] = useState(null); // { code, language }

  const chat = useTutorChat({ greeting: GREETING, courseId });

  // Debugger
  const [debugCode, setDebugCode] = useState(SAMPLE_CODE);
  const [debugLang, setDebugLang] = useState('python');
  const [debugError, setDebugError] = useState('IndexError: list index out of range when target is not in array');
  const [debugResult, setDebugResult] = useState(null);
  const [debugFailure, setDebugFailure] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    // Only courses the student can actually use: the tutor checks enrollment (and payment) server-side too.
    api.get('/courses/enrolled/me')
      .then((res) => setCourses((res.data || []).filter((e) => e.is_active !== false).map((e) => e.course).filter(Boolean)))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));
  }, []);

  const openCanvas = useCallback((code, language) => setCanvas({ code, language }), []);

  const askAbout = (course) => {
    setActiveTab('tutor');
    setCourseId(course.id);
    chat.send(`Give me an overview of the key concepts in "${course.title}".`);
  };

  const handleReset = () => {
    chat.reset('Conversation cleared. What would you like to learn next?');
    setCanvas(null);
    toast.success('Conversation cleared');
  };

  const runDebug = async (event) => {
    event?.preventDefault();
    if (!debugCode.trim() || debugLoading) return;
    setDebugLoading(true);
    setDebugResult(null);
    setDebugFailure(null);
    try {
      const res = await api.post('/ai/debug', {
        code: debugCode,
        language: debugLang,
        error_message: debugError.trim() || undefined,
      }, { timeout: 90000 });
      setDebugResult(res.data);
    } catch (err) {
      setDebugFailure(describeApiError(err));
    } finally {
      setDebugLoading(false);
    }
  };

  return (
    <div className="ai-page">
      <div className="ai-page-header">
        <h1 className="ai-page-title"><FiCpu size={26} /> Study Assistant</h1>
        <p className="ai-page-sub">Ask programming questions, debug code, or get answers grounded in your courses.</p>
      </div>

      <div className={`ai-shell ${canvas ? 'has-canvas' : ''}`}>
        <nav className="ai-rail" aria-label="AI tools">
          <div className="ai-rail-group">
            <span className="ai-rail-label">AI tools</span>
            <button type="button" className={`ai-rail-item ${activeTab === 'tutor' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('tutor')} aria-current={activeTab === 'tutor' ? 'page' : undefined}>
              <FiMessageSquare size={16} /><span>AI Tutor Chat</span>
            </button>
            <button type="button" className={`ai-rail-item ${activeTab === 'debugger' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('debugger')} aria-current={activeTab === 'debugger' ? 'page' : undefined}>
              <FiCode size={16} /><span>Code Debugger</span>
            </button>
          </div>

          <div className="ai-rail-group">
            <span className="ai-rail-label">Your courses</span>
            <div className="ai-rail-scroll">
              {courses.map((course) => (
                <button key={course.id} type="button" className={`ai-rail-item ${activeTab === 'tutor' && courseId === course.id ? 'is-active' : ''}`}
                  onClick={() => askAbout(course)} title={`Ask about ${course.title}`}>
                  <FiBookOpen size={15} /><span>{course.title}</span>
                </button>
              ))}
              {courses.length === 0 && (
                <div className="ai-rail-empty">{coursesLoading ? 'Loading courses…' : 'Enroll in a course to ask about its material.'}</div>
              )}
            </div>
          </div>

          <div className="ai-rail-group is-secondary">
            <span className="ai-rail-label">Quick prompts</span>
            {QUICK_PROMPTS.map((text) => (
              <button key={text} type="button" className="ai-rail-item" onClick={() => { setActiveTab('tutor'); chat.send(text); }}>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </nav>

        {activeTab === 'tutor' ? (
          <TutorChatPanel
            chat={chat}
            title="AI Tutor Chat"
            subtitle="Interactive tutor and conceptual guide"
            courses={courses}
            courseId={courseId}
            onCourseChange={setCourseId}
            onReset={handleReset}
            onOpenCanvas={openCanvas}
          />
        ) : (
          <div className="ai-split">
            <section className="ai-panel" aria-label="Code to debug">
              <header className="ai-panel-head">
                <div>
                  <h2 className="ai-panel-title">Code Debugger</h2>
                  <span className="ai-panel-sub">Find syntax errors and logic flaws</span>
                </div>
                <select className="ai-select" value={debugLang} onChange={(e) => setDebugLang(e.target.value)} aria-label="Language">
                  {DEBUG_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </header>
              <form className="ai-pane-body" onSubmit={runDebug}>
                <div className="ai-field" style={{ flex: 1 }}>
                  <label htmlFor="debug-code">Code</label>
                  <textarea id="debug-code" className="ai-code-input" value={debugCode} spellCheck="false" required
                    maxLength={50000} onChange={(e) => setDebugCode(e.target.value)} placeholder="Paste your code here…" />
                </div>
                <div className="ai-field">
                  <label htmlFor="debug-error">Error message or traceback (optional)</label>
                  <input id="debug-error" className="form-input" value={debugError} maxLength={10000}
                    onChange={(e) => setDebugError(e.target.value)} placeholder="e.g. IndexError, or a failing test case" />
                </div>
                <LoadingButton type="submit" loading={debugLoading} loadingText="Analyzing…" className="btn btn-primary">
                  <FiTerminal size={15} /> Analyze &amp; debug
                </LoadingButton>
              </form>
            </section>

            <section className="ai-panel" aria-label="Diagnostic result" aria-live="polite">
              <header className="ai-panel-head">
                <div>
                  <h2 className="ai-panel-title">Diagnostic result</h2>
                  <span className="ai-panel-sub">What’s wrong, and how to fix it</span>
                </div>
              </header>
              <div className="ai-pane-body">
                {debugFailure && <ErrorState title="Analysis failed" description={debugFailure} onRetry={runDebug} />}
                {!debugFailure && !debugResult && (
                  <EmptyState icon={FiCode} title="No analysis yet" description="Paste code and choose “Analyze & debug” to get a diagnosis." />
                )}
                {debugResult && (
                  <>
                    <MarkdownContent content={debugResult.explanation} />
                    {debugResult.fixed_code && (
                      <MarkdownContent content={`**Corrected code**\n\n\`\`\`${debugLang}\n${debugResult.fixed_code}\n\`\`\``} onOpenCanvas={openCanvas} />
                    )}
                    {debugResult.suggestions?.length > 0 && (
                      <MarkdownContent content={`**Tips**\n\n${debugResult.suggestions.map((s) => `- ${s}`).join('\n')}`} />
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {canvas && (
          <CodeCanvas code={canvas.code} language={canvas.language}
            onChange={(code) => setCanvas((c) => ({ ...c, code }))} onClose={() => setCanvas(null)} />
        )}
      </div>
    </div>
  );
}
