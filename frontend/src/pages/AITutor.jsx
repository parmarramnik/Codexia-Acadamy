import { useCallback, useEffect, useState } from 'react';
import { FiCpu, FiMessageSquare, FiTrendingUp } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import TutorChatPanel from '../components/ai/TutorChatPanel';
import CodeCanvas from '../components/ai/CodeCanvas';
import useTutorChat from '../hooks/useTutorChat';
import '../styles/ai-workspace.css';

const GREETING = 'Hello! I’m your AI learning assistant. How can I help you with your studies today?';
const QUICK_COMMANDS = [
  ['Explain a concept', 'Explain the time complexity of quicksort'],
  ['Debugging hint', 'Give me hints to debug a runtime stack overflow'],
  ['Optimize an algorithm', 'How do I optimize database joins?'],
];

export default function AITutor() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [canvas, setCanvas] = useState(null);
  const chat = useTutorChat({ greeting: GREETING, courseId });

  useEffect(() => {
    api.post('/ai/recommend').then((res) => setRecommendation(res.data.recommendation)).catch(() => {});
    api.get('/courses/enrolled/me')
      .then((res) => setCourses((res.data || []).filter((e) => e.is_active !== false).map((e) => e.course).filter(Boolean)))
      .catch(() => setCourses([]));
  }, []);

  const openCanvas = useCallback((code, language) => setCanvas({ code, language }), []);

  const handleReset = () => {
    chat.reset('Session cleared. Ask me a new concept or topic.');
    setCanvas(null);
    toast.success('Conversation cleared');
  };

  return (
    <div className="ai-page">
      <div className="ai-page-header">
        <h1 className="ai-page-title"><FiCpu size={26} /> AI Tutor</h1>
        <p className="ai-page-sub">Clear explanations with examples, code and math. Pick a course to answer from its material.</p>
      </div>

      <div className={`ai-shell ${canvas ? 'has-canvas' : ''}`}>
        <aside className="ai-rail" aria-label="Assistant hub">
          {recommendation && (
            <div className="ai-rail-group">
              <span className="ai-rail-label">Recommended next</span>
              <div className="ai-rail-item" style={{ cursor: 'default', height: 'auto', padding: 'var(--space-3)', alignItems: 'flex-start' }}>
                <FiTrendingUp size={16} />
                <span style={{ whiteSpace: 'normal' }}>{recommendation}</span>
              </div>
            </div>
          )}
          <div className="ai-rail-group">
            <span className="ai-rail-label">Quick commands</span>
            {QUICK_COMMANDS.map(([label, prompt]) => (
              <button key={label} type="button" className="ai-rail-item" onClick={() => chat.send(prompt)} title={prompt}>
                <FiMessageSquare size={15} /><span>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <TutorChatPanel
          chat={chat}
          title="Conversation"
          subtitle="Answers use Markdown, code and math"
          courses={courses}
          courseId={courseId}
          onCourseChange={setCourseId}
          onReset={handleReset}
          onOpenCanvas={openCanvas}
        />

        {canvas && (
          <CodeCanvas code={canvas.code} language={canvas.language}
            onChange={(code) => setCanvas((c) => ({ ...c, code }))} onClose={() => setCanvas(null)} />
        )}
      </div>
    </div>
  );
}
