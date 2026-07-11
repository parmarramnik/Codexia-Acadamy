import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiClock, FiAlertCircle, FiCheck, FiX, FiAward } from 'react-icons/fi';

export default function Quiz() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [attemptResult, setAttemptResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchQuiz() {
      setIsLoading(true);
      try {
        const res = await api.get(`/quizzes/${id}`);
        setQuiz(res.data);
        setQuestions(res.data.questions || []);
        setTimeLeft(res.data.time_limit_minutes * 60);
      } catch (err) {
        toast.error('Failed to load quiz details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuiz();
  }, [id]);

  // Quiz Countdown Timer
  useEffect(() => {
    if (!quiz || attemptResult || timeLeft <= 0) {
      if (timeLeft === 0 && quiz && !attemptResult) {
        handleAutoSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz, timeLeft, attemptResult]);

  const handleSelectAnswer = (questionId, answerId) => {
    setResponses((prev) => {
      const selected = prev[questionId] || [];
      if (selected.includes(answerId)) {
        return { ...prev, [questionId]: selected.filter((id) => id !== answerId) };
      } else {
        return { ...prev, [questionId]: [...selected, answerId] };
      }
    });
  };

  const handleAutoSubmit = () => {
    toast.error('Time is up! Submitting your answers.');
    submitQuiz();
  };

  const submitQuiz = async () => {
    setIsSubmitting(true);
    try {
      const payloadResponses = Object.entries(responses).map(([qId, answerIds]) => ({
        question_id: parseInt(qId),
        selected_answer_ids: answerIds,
        text_answer: null,
      }));

      // If a question was skipped, we send empty selection
      questions.forEach((q) => {
        if (!responses[q.id]) {
          payloadResponses.push({
            question_id: q.id,
            selected_answer_ids: [],
            text_answer: null,
          });
        }
      });

      const res = await api.post(`/quizzes/${id}/attempt`, {
        responses: payloadResponses,
        time_taken_seconds: quiz.time_limit_minutes * 60 - timeLeft,
      });

      setAttemptResult(res.data);
      toast.success('Quiz submitted successfully!');
    } catch (err) {
      toast.error('Failed to submit quiz attempt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Preparing quiz questions...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={styles.emptyState}>
        <h3>Quiz Not Found</h3>
        <Link to="/courses" style={styles.backLink}>Back to Courses</Link>
      </div>
    );
  }

  if (attemptResult) {
    return (
      <div style={styles.container}>
        <div style={styles.resultCard}>
          <FiAward size={48} style={styles.resultIcon} />
          <h2 style={styles.resultTitle}>Quiz Completed!</h2>
          <p style={styles.resultSubtitle}>{quiz.title}</p>

          <div style={styles.scoreRow}>
            <div style={styles.scoreBox}>
              <span style={styles.scoreNum}>{attemptResult.score} / {attemptResult.total_marks}</span>
              <span style={styles.scoreLbl}>Score Obtained</span>
            </div>
            <div style={styles.scoreBox}>
              <span style={styles.scoreNum}>{Math.round(attemptResult.percentage)}%</span>
              <span style={styles.scoreLbl}>Percentage</span>
            </div>
            <div style={styles.scoreBox}>
              <span style={attemptResult.is_passed ? styles.passText : styles.failText}>
                {attemptResult.is_passed ? 'PASSED' : 'FAILED'}
              </span>
              <span style={styles.scoreLbl}>Status (Passing: {quiz.passing_percentage}%)</span>
            </div>
          </div>

          <div style={styles.actionRow}>
            <Link to="/dashboard" style={styles.dashboardBtn}>Go to Dashboard</Link>
            <Link to="/courses" style={styles.coursesBtn}>Back to Courses</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.quizHeader}>
        <div>
          <h1 style={styles.quizTitle}>{quiz.title}</h1>
          <p style={styles.quizDesc}>{quiz.description || 'Answer the questions below.'}</p>
        </div>
        <div style={styles.timerBox}>
          <FiClock />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div style={styles.questionsList}>
        {questions.map((question, qIdx) => (
          <div key={question.id} style={styles.questionCard}>
            <div style={styles.questionHeader}>
              <span style={styles.questionNum}>Question {qIdx + 1} of {questions.length}</span>
              <span style={styles.marksBadge}>{question.marks} Marks</span>
            </div>
            <p style={styles.questionContent}>{question.content}</p>

            {question.code_snippet && (
              <pre style={styles.codeSnippet}>{question.code_snippet}</pre>
            )}

            <div style={styles.answersGrid}>
              {question.answers?.map((answer) => {
                const isSelected = responses[question.id]?.includes(answer.id);
                return (
                  <button
                    key={answer.id}
                    onClick={() => handleSelectAnswer(question.id, answer.id)}
                    style={isSelected ? { ...styles.answerBtn, ...styles.answerBtnSelected } : styles.answerBtn}
                  >
                    <span style={isSelected ? { ...styles.bullet, ...styles.bulletSelected } : styles.bullet}>
                      {isSelected && <FiCheck size={12} />}
                    </span>
                    <span style={styles.answerText}>{answer.content}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.submitRow}>
        <button
          onClick={submitQuiz}
          disabled={isSubmitting}
          style={isSubmitting ? { ...styles.submitBtn, ...styles.btnDisabled } : styles.submitBtn}
        >
          {isSubmitting ? 'Submitting attempt...' : 'Finish & Submit Quiz'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '800px',
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
  emptyState: {
    padding: '4rem',
    textAlign: 'center',
  },
  backLink: {
    marginTop: '1rem',
    display: 'inline-block',
    color: 'var(--color-link)',
  },
  quizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '1.5rem',
    marginBottom: '2rem',
    gap: '1.5rem',
  },
  quizTitle: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
  },
  quizDesc: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  timerBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-mono)',
    fontSize: '1.125rem',
    color: 'var(--accent-primary)',
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  questionCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  questionNum: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    fontWeight: 'var(--fw-semibold)',
  },
  marksBadge: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
  },
  questionContent: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    lineHeight: '1.4',
    marginBottom: '1.25rem',
  },
  codeSnippet: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    overflowX: 'auto',
    marginBottom: '1.5rem',
    color: '#FFF',
  },
  answersGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  answerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    textAlign: 'left',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    width: '100%',
  },
  answerBtnSelected: {
    borderColor: 'var(--accent-primary)',
    backgroundColor: 'rgba(255, 161, 22, 0.05)',
  },
  bullet: {
    width: '20px',
    height: '20px',
    borderRadius: 'var(--radius-full)',
    border: '2px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bulletSelected: {
    borderColor: 'var(--accent-primary)',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
  },
  answerText: {
    fontSize: '0.875rem',
  },
  submitRow: {
    marginTop: '3rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem 2rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  btnDisabled: {
    backgroundColor: 'var(--border-primary)',
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
  },
  resultCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '3rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  resultIcon: {
    color: 'var(--accent-primary)',
  },
  resultTitle: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
  },
  resultSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  scoreRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem',
    width: '100%',
    maxWidth: '500px',
    marginTop: '1rem',
    marginBottom: '1rem',
  },
  scoreBox: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '1.25rem 1rem',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  scoreNum: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
  },
  scoreLbl: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  passText: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--color-success)',
  },
  failText: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--color-error)',
  },
  dashboardBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  coursesBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
};
