import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiCheckSquare, 
  FiClock, 
  FiAward, 
  FiBookOpen, 
  FiPlay, 
  FiCheckCircle, 
  FiPlus, 
  FiCpu, 
  FiTrash2, 
  FiX, 
  FiZap 
} from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function QuizHub() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showAiModal, setShowAiModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Quiz Form State
  const [aiForm, setAiForm] = useState({
    topic: '',
    course_id: '',
    question_count: 5,
    difficulty: 'medium',
    time_limit_minutes: 15,
    passing_percentage: 70
  });

  // Manual Quiz Form State
  const [manualForm, setManualForm] = useState({
    title: '',
    description: '',
    course_id: '',
    time_limit_minutes: 15,
    passing_percentage: 70,
    max_attempts: 3,
    questions: [
      {
        content: '',
        explanation: '',
        marks: 10,
        question_type: 'multiple_choice',
        answers: [
          { content: '', is_correct: true },
          { content: '', is_correct: false },
          { content: '', is_correct: false },
          { content: '', is_correct: false }
        ]
      }
    ]
  });

  const isPrivileged = ['instructor', 'admin', 'super_admin'].includes(user?.role);

  const loadQuizzesAndCourses = async () => {
    setIsLoading(true);
    try {
      const [quizRes, courseRes] = await Promise.all([
        api.get('/quizzes'),
        api.get('/courses')
      ]);
      const quizItems = Array.isArray(quizRes.data) ? quizRes.data : (quizRes.data?.items || []);
      const courseItems = Array.isArray(courseRes.data) ? courseRes.data : (courseRes.data?.items || []);
      setQuizzes(quizItems);
      setCourses(courseItems);
    } catch (err) {
      toast.error('Failed to load quiz catalog');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzesAndCourses();
  }, []);

  // Delete Quiz
  const handleDeleteQuiz = async (quizId, title, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete '${title}'?`)) return;
    try {
      await api.delete(`/quizzes/${quizId}`);
      toast.success('Quiz deleted successfully');
      loadQuizzesAndCourses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete quiz');
    }
  };

  // Submit AI Quiz Generation
  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiForm.topic.trim()) {
      toast.error('Please enter a subject or topic name.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        topic: aiForm.topic.trim(),
        course_id: aiForm.course_id ? parseInt(aiForm.course_id) : null,
        question_count: parseInt(aiForm.question_count),
        difficulty: aiForm.difficulty,
        time_limit_minutes: parseInt(aiForm.time_limit_minutes),
        passing_percentage: parseInt(aiForm.passing_percentage)
      };
      const res = await api.post('/quizzes/ai-generate', payload);
      toast.success(res.data.message || 'AI Quiz created!');
      setShowAiModal(false);
      setAiForm({
        topic: '',
        course_id: '',
        question_count: 5,
        difficulty: 'medium',
        time_limit_minutes: 15,
        passing_percentage: 70
      });
      loadQuizzesAndCourses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate AI quiz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Manual Quiz Creation
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.title.trim()) {
      toast.error('Please enter a quiz title.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        title: manualForm.title.trim(),
        description: manualForm.description.trim(),
        course_id: manualForm.course_id ? parseInt(manualForm.course_id) : null,
        time_limit_minutes: parseInt(manualForm.time_limit_minutes),
        passing_percentage: parseInt(manualForm.passing_percentage),
        max_attempts: parseInt(manualForm.max_attempts),
        questions: manualForm.questions.map((q, qIdx) => ({
          question_type: 'multiple_choice',
          content: q.content.trim() || `Question ${qIdx + 1}`,
          explanation: q.explanation.trim() || 'Review concept details.',
          marks: 10,
          order_index: qIdx + 1,
          answers: q.answers.map((a, aIdx) => ({
            content: a.content.trim() || `Option ${aIdx + 1}`,
            is_correct: a.is_correct,
            order_index: aIdx + 1
          }))
        }))
      };

      await api.post('/quizzes', payload);
      toast.success('Quiz created successfully!');
      setShowManualModal(false);
      loadQuizzesAndCourses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create quiz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Question to Manual Form
  const addManualQuestion = () => {
    setManualForm(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          content: '',
          explanation: '',
          marks: 10,
          question_type: 'multiple_choice',
          answers: [
            { content: '', is_correct: true },
            { content: '', is_correct: false },
            { content: '', is_correct: false },
            { content: '', is_correct: false }
          ]
        }
      ]
    }));
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading Quiz Catalog...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <FiCheckSquare style={{ color: 'var(--accent-primary)', marginRight: '10px' }} />
            Interactive Quizzes & Assessments
          </h1>
          <p style={styles.subtitle}>
            Test your skills across programming topics, measure your comprehension, and earn verified scores.
          </p>
        </div>

        {isPrivileged && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAiModal(true)} style={styles.aiBtn}>
              <FiZap size={16} /> ✨ AI Generate Quiz
            </button>
            <button onClick={() => setShowManualModal(true)} style={styles.createBtn}>
              <FiPlus size={16} /> Create Quiz Manually
            </button>
          </div>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div style={styles.emptyCard}>
          <FiCheckSquare size={48} style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ margin: '1rem 0 0.5rem 0' }}>No Quizzes Available</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isPrivileged ? 'Click AI Generate or Create Quiz Manually to add your first assessment!' : 'Check back soon as instructors publish new course assessments.'}
          </p>
        </div>
      ) : (
        <div style={styles.quizGrid}>
          {quizzes.map((quiz) => {
            const hasScore = quiz.user_best_percentage !== null && quiz.user_best_percentage !== undefined;
            const isPassed = hasScore && quiz.user_best_percentage >= quiz.passing_percentage;

            return (
              <div key={quiz.id} style={styles.quizCard}>
                <div style={styles.cardHeader}>
                  <span style={styles.courseTag}>
                    <FiBookOpen size={12} style={{ marginRight: '4px' }} />
                    {quiz.course_title}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {hasScore && (
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: isPassed ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                        color: isPassed ? '#2ECC71' : '#E74C3C',
                        borderColor: isPassed ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)',
                      }}>
                        <FiCheckCircle size={12} style={{ marginRight: '4px' }} />
                        {isPassed ? 'Passed' : 'Attempted'}
                      </span>
                    )}

                    {isPrivileged && (
                      <button
                        onClick={(e) => handleDeleteQuiz(quiz.id, quiz.title, e)}
                        style={styles.deleteBtn}
                        title="Delete Quiz"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <h2 style={styles.quizTitle}>{quiz.title}</h2>
                <p style={styles.quizDesc}>{quiz.description || 'Test your knowledge on this module.'}</p>

                <div style={styles.metaRow}>
                  <div style={styles.metaItem}>
                    <FiClock size={14} style={{ marginRight: '4px' }} />
                    <span>{quiz.time_limit_minutes} mins</span>
                  </div>
                  <div style={styles.metaItem}>
                    <FiCheckSquare size={14} style={{ marginRight: '4px' }} />
                    <span>{quiz.question_count} questions</span>
                  </div>
                  <div style={styles.metaItem}>
                    <FiAward size={14} style={{ marginRight: '4px' }} />
                    <span>{quiz.passing_percentage}% pass mark</span>
                  </div>
                </div>

                {hasScore && (
                  <div style={styles.scoreRow}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Best Score:</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                      {Math.round(quiz.user_best_percentage)}%
                    </span>
                  </div>
                )}

                <Link to={`/quizzes/${quiz.id}`} style={styles.startBtn}>
                  <FiPlay size={14} style={{ marginRight: '6px' }} />
                  {hasScore ? 'Retake Quiz' : 'Start Quiz'}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Quiz Generation Modal */}
      {showAiModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2>✨ Generate Quiz with AI</h2>
              <button onClick={() => setShowAiModal(false)} style={styles.closeBtn}><FiX size={20} /></button>
            </div>
            <form onSubmit={handleAiSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Subject / Topic Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Python Data Structures, React Hooks, SQL Joins"
                  value={aiForm.topic}
                  onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Link to Course (Optional)</label>
                <select
                  value={aiForm.course_id}
                  onChange={(e) => setAiForm({ ...aiForm, course_id: e.target.value })}
                  style={styles.select}
                >
                  <option value="">General Assessment (No Course)</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Total Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={aiForm.question_count}
                    onChange={(e) => setAiForm({ ...aiForm, question_count: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Difficulty</label>
                  <select
                    value={aiForm.difficulty}
                    onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}
                    style={styles.select}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Time Limit (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={aiForm.time_limit_minutes}
                    onChange={(e) => setAiForm({ ...aiForm, time_limit_minutes: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Passing %</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={aiForm.passing_percentage}
                    onChange={(e) => setAiForm({ ...aiForm, passing_percentage: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <LoadingButton loading={isSubmitting} type="submit" style={styles.aiSubmitBtn}>
                ✨ Generate & Publish AI Quiz
              </LoadingButton>
            </form>
          </div>
        </div>
      )}

      {/* Manual Quiz Creation Modal */}
      {showManualModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '700px' }}>
            <div style={styles.modalHeader}>
              <h2>➕ Create Quiz Manually</h2>
              <button onClick={() => setShowManualModal(false)} style={styles.closeBtn}><FiX size={20} /></button>
            </div>
            <form onSubmit={handleManualSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Quiz Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Master JavaScript Fundamentals Quiz"
                  value={manualForm.title}
                  onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  placeholder="Describe the assessment objectives..."
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  style={{ ...styles.input, minHeight: '60px' }}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Link to Course (Optional)</label>
                <select
                  value={manualForm.course_id}
                  onChange={(e) => setManualForm({ ...manualForm, course_id: e.target.value })}
                  style={styles.select}
                >
                  <option value="">General Assessment (No Course)</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Time Limit (Mins)</label>
                  <input
                    type="number"
                    value={manualForm.time_limit_minutes}
                    onChange={(e) => setManualForm({ ...manualForm, time_limit_minutes: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Passing %</label>
                  <input
                    type="number"
                    value={manualForm.passing_percentage}
                    onChange={(e) => setManualForm({ ...manualForm, passing_percentage: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <h4 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--accent-primary)' }}>Questions ({manualForm.questions.length})</h4>
              {manualForm.questions.map((q, qIdx) => (
                <div key={qIdx} style={styles.questionBlock}>
                  <div style={{ fontWeight: '600', marginBottom: '6px' }}>Question {qIdx + 1}</div>
                  <input
                    type="text"
                    placeholder={`Enter Question ${qIdx + 1} text...`}
                    value={q.content}
                    onChange={(e) => {
                      const updated = [...manualForm.questions];
                      updated[qIdx].content = e.target.value;
                      setManualForm({ ...manualForm, questions: updated });
                    }}
                    style={styles.input}
                    required
                  />

                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {q.answers.map((ans, aIdx) => (
                      <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="radio"
                          name={`correct_${qIdx}`}
                          checked={ans.is_correct}
                          onChange={() => {
                            const updated = [...manualForm.questions];
                            updated[qIdx].answers = updated[qIdx].answers.map((a, idx) => ({
                              ...a,
                              is_correct: idx === aIdx
                            }));
                            setManualForm({ ...manualForm, questions: updated });
                          }}
                        />
                        <input
                          type="text"
                          placeholder={`Option ${aIdx + 1}`}
                          value={ans.content}
                          onChange={(e) => {
                            const updated = [...manualForm.questions];
                            updated[qIdx].answers[aIdx].content = e.target.value;
                            setManualForm({ ...manualForm, questions: updated });
                          }}
                          style={{ ...styles.input, padding: '4px 8px', fontSize: '0.85rem' }}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button type="button" onClick={addManualQuestion} style={styles.addQBtn}>
                ➕ Add Another Question
              </button>

              <LoadingButton loading={isSubmitting} type="submit" style={{ ...styles.aiSubmitBtn, background: 'var(--accent-primary)', marginTop: '1rem' }}>
                Publish Quiz
              </LoadingButton>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '2rem', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  title: { fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.5rem' },
  aiBtn: { backgroundColor: '#8E44AD', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' },
  createBtn: { backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' },
  emptyCard: { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '3rem', textAlign: 'center' },
  quizGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' },
  quizCard: { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  courseTag: { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center' },
  statusBadge: { padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', border: '1px solid', display: 'flex', alignItems: 'center' },
  deleteBtn: { backgroundColor: 'rgba(244, 67, 54, 0.15)', color: '#F44336', border: '1px solid rgba(244, 67, 54, 0.3)', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' },
  quizTitle: { fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' },
  quizDesc: { color: 'var(--text-secondary)', fontSize: '0.88rem', flex: 1, marginBottom: '1.2rem', lineHeight: '1.4' },
  metaRow: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', padding: '0.8rem 0', marginBottom: '1rem' },
  metaItem: { display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' },
  scoreRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', backgroundColor: 'rgba(255, 161, 22, 0.05)', padding: '6px 12px', borderRadius: '6px' },
  startBtn: { backgroundColor: 'var(--accent-primary)', color: '#fff', textAlign: 'center', padding: '0.7rem', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { display: 'flex', justifyContent: 'center', padding: '5rem' },
  loadingText: { color: 'var(--text-secondary)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' },
  modalContent: { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '14px', width: '100%', maxWidth: '540px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 },
  label: { fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' },
  input: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '0.6rem 0.8rem', color: 'var(--text-primary)' },
  select: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '0.6rem 0.8rem', color: 'var(--text-primary)' },
  row: { display: 'flex', gap: '1rem' },
  aiSubmitBtn: { backgroundColor: '#8E44AD', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  questionBlock: { backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '10px' },
  addQBtn: { backgroundColor: 'transparent', color: 'var(--accent-primary)', border: '1px dashed var(--accent-primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }
};
