import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiTrendingUp, FiActivity, FiClock, FiCheckSquare, FiAward, FiCode, FiCalendar } from 'react-icons/fi';

export default function Analytics() {
  const [stats, setStats] = useState({
    total_courses_enrolled: 0,
    completed_courses: 0,
    total_study_hours: 0,
    quizzes_taken: 0,
    average_quiz_score: 0,
    problems_solved: 0,
    current_streak: 0,
    certificates_earned: 0,
  });
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true);
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/analytics/sessions?days=30')
        ]);
        setStats(statsRes.data);
        setSessions(sessionsRes.data || []);
      } catch (err) {
        toast.error('Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Compiling analytics indices...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Learning Analytics</h1>
        <p style={styles.subtitle}>Track your study time, Streaks, quiz results, and coding sandbox accomplishments.</p>
      </div>

      {/* Grid Overview Widgets */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <FiClock size={20} style={styles.statIcon} />
            <span style={styles.statLabel}>Study Hours</span>
          </div>
          <span style={styles.statValue}>{stats.total_study_hours}h</span>
          <span style={styles.statFoot}>Total cumulative hours</span>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <FiActivity size={20} style={styles.statIcon} />
            <span style={styles.statLabel}>Current Streak</span>
          </div>
          <span style={styles.statValue}>{stats.current_streak} Days</span>
          <span style={styles.statFoot}>Consecutive study days</span>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <FiCheckSquare size={20} style={styles.statIcon} />
            <span style={styles.statLabel}>Quiz Average</span>
          </div>
          <span style={styles.statValue}>{stats.average_quiz_score}%</span>
          <span style={styles.statFoot}>{stats.quizzes_taken} Quizzes completed</span>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <FiCode size={20} style={styles.statIcon} />
            <span style={styles.statLabel}>Problems Solved</span>
          </div>
          <span style={styles.statValue}>{stats.problems_solved}</span>
          <span style={styles.statFoot}>Sandboxed test passes</span>
        </div>
      </div>

      <div style={styles.layoutGrid}>
        {/* Study History list timeline */}
        <div style={styles.sessionsBox}>
          <h2 style={styles.sectionHeading}><FiCalendar /> Study History (Last 30 Days)</h2>
          {sessions.length === 0 ? (
            <p style={styles.emptyText}>No recent study sessions logged. Start watching lectures or taking quizzes to record activity.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tr}>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Duration</th>
                  <th style={styles.th}>Lectures</th>
                  <th style={styles.th}>Quizzes</th>
                  <th style={styles.th}>Coding Pass</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>{new Date(s.date).toLocaleDateString()}</td>
                    <td style={styles.td}>{s.duration_minutes} min</td>
                    <td style={styles.td}>{s.lectures_watched} lectures</td>
                    <td style={styles.td}>{s.quizzes_completed} quizzes</td>
                    <td style={styles.td}>{s.problems_solved} solved</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Skills/Topics Strengths */}
        <div style={styles.sideCard}>
          <h2 style={styles.sectionHeading}><FiTrendingUp /> Topic Summary</h2>
          <div style={styles.topicRow}>
            <span style={styles.topicTitle}>Data Structures & Algorithms</span>
            <div style={styles.progressRow}>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: '80%' }}></div>
              </div>
              <span style={styles.progressText}>80%</span>
            </div>
          </div>
          <div style={styles.topicRow}>
            <span style={styles.topicTitle}>Web Development Core</span>
            <div style={styles.progressRow}>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: '65%' }}></div>
              </div>
              <span style={styles.progressText}>65%</span>
            </div>
          </div>
          <div style={styles.topicRow}>
            <span style={styles.topicTitle}>Machine Learning Basics</span>
            <div style={styles.progressRow}>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: '40%' }}></div>
              </div>
              <span style={styles.progressText}>40%</span>
            </div>
          </div>
        </div>
      </div>
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
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1.5rem',
    marginBottom: '3rem',
  },
  statCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  statIcon: {
    color: 'var(--text-secondary)',
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
  },
  statFoot: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '2.5rem',
    alignItems: 'flex-start',
  },
  sessionsBox: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
  },
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.875rem',
  },
  tr: {
    borderBottom: '1px solid var(--border-primary)',
  },
  th: {
    padding: '1rem',
    color: 'var(--text-secondary)',
    fontWeight: 'var(--fw-medium)',
  },
  td: {
    padding: '1rem',
  },
  sideCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  topicRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  topicTitle: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  progressBarBg: {
    flex: 1,
    height: '6px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'var(--accent-primary)',
    borderRadius: 'var(--radius-full)',
  },
  progressText: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-secondary)',
  },
};
