import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiCheckSquare, FiClock, FiAward, FiBookOpen, FiPlay, FiCheckCircle } from 'react-icons/fi';

export default function QuizHub() {
  const [quizzes, setQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadQuizzes() {
      setIsLoading(true);
      try {
        const res = await api.get('/quizzes');
        setQuizzes(res.data || []);
      } catch (err) {
        toast.error('Failed to load quiz catalog.');
      } finally {
        setIsLoading(false);
      }
    }
    loadQuizzes();
  }, []);

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
        <h1 style={styles.title}>
          <FiCheckSquare style={{ color: 'var(--accent-primary)', marginRight: '10px' }} />
          Interactive Quizzes & Assessments
        </h1>
        <p style={styles.subtitle}>
          Test your skills across programming topics, measure your comprehension, and earn verified scores.
        </p>
      </div>

      {quizzes.length === 0 ? (
        <div style={styles.emptyCard}>
          <FiCheckSquare size={48} style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ margin: '1rem 0 0.5rem 0' }}>No Quizzes Available</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Check back soon as instructors publish new course assessments.</p>
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
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  header: {
    marginBottom: '2.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'center',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  emptyCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  quizGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.75rem',
  },
  quizCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseTag: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.25rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: 'bold',
    border: '1px solid',
    padding: '0.2rem 0.5rem',
    borderRadius: 'var(--radius-full)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  quizTitle: {
    fontSize: '1.2rem',
    fontWeight: 'var(--fw-semibold)',
    lineHeight: '1.3',
  },
  quizDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    flex: 1,
  },
  metaRow: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    borderTop: '1px solid var(--border-primary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '0.75rem 0',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
  },
  scoreRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  startBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--accent-primary)',
    color: '#1A1A1A',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.65rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    textDecoration: 'none',
    marginTop: '0.5rem',
    textAlign: 'center',
  },
};
