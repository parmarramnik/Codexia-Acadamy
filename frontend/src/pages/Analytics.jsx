import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiTrendingUp, FiActivity, FiClock, 
  FiCheckSquare, FiAward, FiCode, 
  FiCalendar, FiUser, FiBook, FiLayers,
  FiBookOpen, FiCheckCircle
} from 'react-icons/fi';
import { useStudentAnalytics, useStudySessions } from '../hooks/useQueries';

export default function Analytics() {
  const { user } = useAuth();
  const role = user?.role || 'student';

  const [isLoading, setIsLoading] = useState(true);

  // TanStack Query for Student Analytics caching
  const { data: studentData, isLoading: isStudentLoading } = useStudentAnalytics();
  const { data: sessionsData, isLoading: isSessionsLoading } = useStudySessions(30);

  // Student specific state
  const rawStats = studentData ? {
    total_courses_enrolled: studentData.course_progress?.length || 0,
    completed_courses: (studentData.course_progress || []).filter(c => c.progress_percent === 100).length,
    total_study_hours: studentData.study_hours || 0,
    quizzes_taken: studentData.quizzes_taken || 0,
    average_quiz_score: studentData.avg_quiz_score || 0,
    problems_solved: studentData.problems_solved || 0,
    current_streak: studentData.streak_days || 0,
    certificates_earned: studentData.certificates_earned || 0,
    skills_radar: studentData.skills_radar || [],
    course_progress: studentData.course_progress || []
  } : {
    total_courses_enrolled: 0,
    completed_courses: 0,
    total_study_hours: 0,
    quizzes_taken: 0,
    average_quiz_score: 0,
    problems_solved: 0,
    current_streak: 0,
    certificates_earned: 0,
    skills_radar: [],
    course_progress: []
  };

  const sessions = sessionsData || [];

  // Instructor specific state
  const [instructorData, setInstructorData] = useState({
    active_students: 0,
    course_completion_rate: 0.0,
    average_quiz_score: 0.0,
    lecture_watch_rate: 0.0,
    courses_list: []
  });

  // Admin / Super Admin specific state
  const [adminData, setAdminData] = useState({
    total_users: 0,
    students: 0,
    instructors: 0,
    total_courses: 0,
    registrations_last_30_days: 0,
    categories_distribution: []
  });

  useEffect(() => {
    async function loadAnalytics() {
      if (role === 'student') {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        if (role === 'instructor') {
          const res = await api.get('/analytics/instructor');
          setInstructorData(res.data || {
            active_students: 0,
            course_completion_rate: 0.0,
            average_quiz_score: 0.0,
            lecture_watch_rate: 0.0,
            courses_list: []
          });
        } else if (role === 'admin' || role === 'super_admin') {
          const res = await api.get('/analytics/admin');
          setAdminData(res.data || {
            total_users: 0,
            students: 0,
            instructors: 0,
            total_courses: 0,
            registrations_last_30_days: 0,
            categories_distribution: []
          });
        }
      } catch (err) {
        toast.error('Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }
    loadAnalytics();
  }, [role]);

  const effectiveLoading = role === 'student' ? (isStudentLoading && !studentData) : isLoading;

  if (effectiveLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p>
      </div>
    );
  }

  const stats = rawStats;

  // --- RENDER ROLES CONDITIONALLY ---

  // 1. STUDENT VIEW
  if (role === 'student') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Learning Analytics</h1>
          <p style={styles.subtitle}>Track your study time, streaks, quiz results, and coding sandbox accomplishments.</p>
        </div>

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

          <div style={styles.sideCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h2 style={styles.sectionHeading}><FiBookOpen /> Course Progress</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                {stats.course_progress?.length || 0} Enrolled
              </span>
            </div>

            {(!stats.course_progress || stats.course_progress.length === 0) ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>
                No active courses enrolled yet. Browse our catalog to start learning.
              </p>
            ) : (
              stats.course_progress.map((item, idx) => {
                const pct = Math.round(item.progress_percent || 0);
                const isComplete = pct >= 100;
                return (
                  <div key={idx} style={styles.topicRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ ...styles.topicTitle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '210px' }} title={item.title}>
                        {item.title}
                      </span>
                      {isComplete ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <FiCheckCircle size={12} /> Done
                        </span>
                      ) : null}
                    </div>
                    <div style={styles.progressRow}>
                      <div style={styles.progressBarBg}>
                        <div style={{
                          ...styles.progressBarFill,
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: isComplete ? 'var(--color-success)' : 'var(--accent-primary)'
                        }}></div>
                      </div>
                      <span style={styles.progressText}>{pct}%</span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Real Skill Mastery: Only show if user has real problem or course activity */}
            {stats.skills_radar && stats.skills_radar.some(s => (s.A || 0) > 0) && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-secondary)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiTrendingUp /> Verified Topic Mastery
                </h3>
                {stats.skills_radar.filter(s => (s.A || 0) > 0).map((skill, sIdx) => (
                  <div key={sIdx} style={{ ...styles.topicRow, marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{skill.subject}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{skill.A}%</span>
                    </div>
                    <div style={styles.progressBarBg}>
                      <div style={{ ...styles.progressBarFill, width: `${Math.min(skill.A, 100)}%`, height: '4px' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. INSTRUCTOR VIEW
  if (role === 'instructor') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Instructor Panel Analytics</h1>
          <p style={styles.subtitle}>Monitor active enrollments, course completions, and performance markers across your curriculum.</p>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiUser size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Active Students</span>
            </div>
            <span style={styles.statValue}>{instructorData.active_students}</span>
            <span style={styles.statFoot}>Total course enrollments</span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiActivity size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Avg Completion Rate</span>
            </div>
            <span style={styles.statValue}>{instructorData.course_completion_rate}%</span>
            <span style={styles.statFoot}>Progress completion percentage</span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiCheckSquare size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Quiz Class Average</span>
            </div>
            <span style={styles.statValue}>{instructorData.average_quiz_score}%</span>
            <span style={styles.statFoot}>Score average across attempts</span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiClock size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Lecture Watch Rate</span>
            </div>
            <span style={styles.statValue}>{instructorData.lecture_watch_rate}%</span>
            <span style={styles.statFoot}>Average video watch rates</span>
          </div>
        </div>

        <div style={styles.fullWidthCard}>
          <h2 style={styles.sectionHeading}><FiBook /> Course Performance Ledger</h2>
          {instructorData.courses_list.length === 0 ? (
            <p style={styles.emptyText}>No courses created yet. Visit your Instructor Panel to publish your first programming course.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr style={styles.tr}>
                  <th style={styles.th}>Course ID</th>
                  <th style={styles.th}>Course Title</th>
                  <th style={styles.th}>Enrolled Students</th>
                </tr>
              </thead>
              <tbody>
                {instructorData.courses_list.map((c) => (
                  <tr key={c.id} style={styles.tr}>
                    <td style={styles.td}>#{c.id}</td>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{c.title}</td>
                    <td style={styles.td}>{c.enrollment_count} students</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // 3. ADMIN / SUPER ADMIN VIEW
  if (role === 'admin' || role === 'super_admin') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Executive Platform Analytics</h1>
          <p style={styles.subtitle}>System-wide overview of user signups, course catalog distributions, and active metrics.</p>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiUser size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Total Platform Users</span>
            </div>
            <span style={styles.statValue}>{adminData.total_users}</span>
            <span style={styles.statFoot}>Registered accounts</span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiBook size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Total Courses</span>
            </div>
            <span style={styles.statValue}>{adminData.total_courses}</span>
            <span style={styles.statFoot}>Published course catalog</span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiActivity size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>New Signups</span>
            </div>
            <span style={styles.statValue}>+{adminData.registrations_last_30_days}</span>
            <span style={styles.statFoot}>Last 30 days registrations</span>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statHeader}>
              <FiTrendingUp size={20} style={styles.statIcon} />
              <span style={styles.statLabel}>Instructor Ratio</span>
            </div>
            <span style={styles.statValue}>{adminData.instructors} / {adminData.students}</span>
            <span style={styles.statFoot}>Instructors vs Students</span>
          </div>
        </div>

        <div style={styles.layoutGrid}>
          <div style={styles.sessionsBox}>
            <h2 style={styles.sectionHeading}><FiLayers size={18} style={{ marginRight: '6px' }} /> Category Catalog Distribution</h2>
            {adminData.categories_distribution.length === 0 ? (
              <p style={styles.emptyText}>No courses have been tagged with categories yet.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tr}>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Course Count</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData.categories_distribution.map((cat, i) => (
                    <tr key={i} style={styles.tr}>
                      <td style={{ ...styles.td, textTransform: 'capitalize', fontWeight: '500' }}>
                        {cat.category || 'Uncategorized'}
                      </td>
                      <td style={styles.td}>{cat.count} courses</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={styles.sideCard}>
            <h2 style={styles.sectionHeading}><FiActivity /> System Status</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={styles.systemRow}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ONLINE</span>
              </div>
              <div style={styles.systemRow}>
                <span style={{ color: 'var(--text-secondary)' }}>Region:</span>
                <span>Production Global</span>
              </div>
              <div style={styles.systemRow}>
                <span style={{ color: 'var(--text-secondary)' }}>Platform Version:</span>
                <span>v1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
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
  fullWidthCard: {
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
  systemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem'
  }
};
