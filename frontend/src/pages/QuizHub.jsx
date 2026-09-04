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
  FiZap,
  FiSearch
} from 'react-icons/fi';

import LoadingButton from '../components/common/LoadingButton';
import PageLoader from '../components/common/PageLoader';
import { useQuizzes, useCourses, useInvalidateCache } from '../hooks/useQueries';

export default function QuizHub() {
  const { user } = useAuth();
  const { data: quizData, isLoading: isQuizzesLoading } = useQuizzes();
  const { data: courseData, isLoading: isCoursesLoading } = useCourses();
  const { invalidateQuizzes } = useInvalidateCache();

  const quizzes = quizData || [];
  const courses = courseData?.items || (Array.isArray(courseData) ? courseData : []);
  const isLoading = (isQuizzesLoading && !quizData) || (isCoursesLoading && !courseData);

  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');


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

  // Delete Quiz
  const handleDeleteQuiz = async (quizId, title, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete '${title}'?`)) return;
    try {
      await api.delete(`/quizzes/${quizId}`);
      toast.success('Quiz deleted successfully');
      invalidateQuizzes();
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
      invalidateQuizzes();
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
      invalidateQuizzes();
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
    return <PageLoader />;
  }

  const filteredQuizzes = quizzes.filter((quiz) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      (quiz.title || '').toLowerCase().includes(q) ||
      (quiz.description || '').toLowerCase().includes(q) ||
      (quiz.course_title || '').toLowerCase().includes(q);
    const matchesCourse = !courseFilter || String(quiz.course_id) === String(courseFilter);
    return matchesSearch && matchesCourse;
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <FiCheckSquare style={{ color: '#818CF8', marginRight: '10px' }} />
            Quizzes & Assessments
          </h1>
          <p style={styles.subtitle}>
            Test your programming knowledge, measure your comprehension, and track verified scores.
          </p>
        </div>

        {isPrivileged && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowAiModal(true)} style={styles.aiBtn}>
              <FiZap size={16} /> Quick Generator
            </button>
            <button onClick={() => setShowManualModal(true)} style={styles.createBtn}>
              <FiPlus size={16} /> Create Quiz
            </button>
          </div>
        )}
      </div>

      {/* Contextual Quiz Search & Filters Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <FiSearch size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: searchQuery ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search assessments by title, topic, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 36px 10px 42px',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                padding: '4px'
              }}
              title="Clear search"
            >✕</button>
          )}
        </div>

        {courses.length > 0 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              fontSize: '0.88rem',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Associated Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {quizzes.length === 0 ? (
        <div style={styles.emptyCard}>
          <FiCheckSquare size={48} style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ margin: '1rem 0 0.5rem 0' }}>No Quizzes Available</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isPrivileged ? 'Click Quick Generator or Create Quiz Manually to add your first assessment!' : 'Check back soon as instructors publish new course assessments.'}
          </p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div style={styles.emptyCard}>
          <FiSearch size={44} style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ margin: '1rem 0 0.5rem 0' }}>No Assessments Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            No assessments match "{searchQuery}". Try a different keyword or course filter.
          </p>
          <button
            onClick={() => { setSearchQuery(''); setCourseFilter(''); }}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div style={styles.quizGrid}>
          {filteredQuizzes.map((quiz) => {

            const hasScore = quiz.user_best_percentage !== null && quiz.user_best_percentage !== undefined;
            const isPassed = hasScore && quiz.user_best_percentage >= quiz.passing_percentage;
            const cleanTitle = (quiz.title || '').replace(/^AI Quiz:\s*/i, '');

            return (
              <div key={quiz.id} style={styles.quizCard}>
                {/* Top Badge & Status Bar */}
                <div style={styles.cardHeader}>
                  <div style={styles.courseTag} title={quiz.course_title || 'General Assessment'}>
                    <FiBookOpen size={12} style={{ flexShrink: 0 }} />
                    <span style={styles.courseTagText}>
                      {quiz.course_title || 'General Assessment'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {hasScore ? (
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: isPassed ? '#10B981' : '#F59E0B',
                        border: isPassed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                      }}>
                        {isPassed ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
                        <span>{isPassed ? 'Passed' : 'Attempted'}</span>
                      </span>
                    ) : (
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-primary)',
                      }}>
                        Ready
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

                {/* Content Section */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h2 style={styles.quizTitle} title={cleanTitle}>{cleanTitle}</h2>
                  <p style={styles.quizDesc}>
                    {quiz.description || 'Test your knowledge on key topic concepts and measure your progress.'}
                  </p>
                </div>

                {/* Metadata Row */}
                <div style={styles.metaRow}>
                  <div style={styles.metaItem}>
                    <FiClock size={13} style={{ color: '#38BDF8' }} />
                    <span>{quiz.time_limit_minutes}m limit</span>
                  </div>
                  <div style={styles.metaItem}>
                    <FiCheckSquare size={13} style={{ color: '#818CF8' }} />
                    <span>{quiz.question_count} items</span>
                  </div>
                  <div style={styles.metaItem}>
                    <FiAward size={13} style={{ color: '#FBBF24' }} />
                    <span>{quiz.passing_percentage}% pass</span>
                  </div>
                </div>

                {/* Best Score Progress Box */}
                {hasScore && (
                  <div style={styles.scoreRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Best Score</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isPassed ? '#10B981' : '#F59E0B' }}>
                        {Math.round(quiz.user_best_percentage)}%
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                          (pass: {quiz.passing_percentage}%)
                        </span>
                      </span>
                    </div>
                    <div style={styles.progressBarBg}>
                      <div style={{
                        ...styles.progressBarFill,
                        width: `${Math.min(100, Math.round(quiz.user_best_percentage))}%`,
                        backgroundColor: isPassed ? '#10B981' : '#F59E0B',
                      }} />
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Link
                  to={`/quizzes/${quiz.id}`}
                  style={{
                    ...styles.startBtn,
                    background: isPassed
                      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    boxShadow: isPassed
                      ? '0 4px 12px rgba(16, 185, 129, 0.22)'
                      : '0 4px 12px rgba(99, 102, 241, 0.22)',
                  }}
                >
                  <FiPlay size={14} />
                  <span>{hasScore ? 'Retake Quiz' : 'Start Assessment'}</span>
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.25rem', flexWrap: 'wrap', gap: '1rem' },
  title: { fontSize: '1.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', color: 'var(--text-primary)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.92rem' },
  aiBtn: { backgroundColor: '#4F46E5', color: '#fff', border: 'none', padding: '0.55rem 1.15rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' },
  createBtn: { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '0.55rem 1.15rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem' },
  emptyCard: { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '16px', padding: '3.5rem 2rem', textAlign: 'center' },
  quizGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' },
  quizCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '16px',
    padding: '1.4rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.22)',
    transition: 'all 0.2s ease',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '8px' },
  courseTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.74rem',
    fontWeight: 600,
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: '4px 9px',
    borderRadius: '8px',
    maxWidth: '60%',
    overflow: 'hidden',
  },
  courseTagText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 8px',
    borderRadius: '9999px',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#EF4444',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    padding: '4px 7px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0.35rem 0 0.4rem 0',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  quizDesc: {
    color: 'var(--text-secondary)',
    fontSize: '0.84rem',
    lineHeight: 1.5,
    margin: '0 0 1rem 0',
    minHeight: '38px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
    borderTop: '1px solid var(--border-primary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '0.7rem 0',
    marginBottom: '1rem',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: 'var(--text-secondary)',
    fontSize: '0.76rem',
    fontWeight: 500,
  },
  scoreRow: {
    marginBottom: '1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-primary)',
    borderRadius: '10px',
    padding: '0.6rem 0.85rem',
  },
  progressBarBg: {
    height: '5px',
    borderRadius: '3px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  startBtn: {
    color: '#ffffff',
    textAlign: 'center',
    padding: '0.65rem 1rem',
    borderRadius: '10px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.88rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' },
  modalContent: { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '16px', width: '100%', maxWidth: '540px', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 },
  label: { fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' },
  input: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'var(--text-primary)' },
  select: { backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'var(--text-primary)' },
  row: { display: 'flex', gap: '1rem' },
  aiSubmitBtn: { backgroundColor: '#4F46E5', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
  questionBlock: { backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', borderRadius: '10px', padding: '12px' },
  addQBtn: { backgroundColor: 'transparent', color: 'var(--accent-primary)', border: '1px dashed var(--accent-primary)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }
};
