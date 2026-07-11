import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiBookOpen, FiClock, FiTarget, FiActivity, FiAward, FiCode, FiCpu } from 'react-icons/fi';
import InstructorDashboard from './InstructorDashboard';
import AdminDashboard from './AdminDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  // Dynamically render dashboard based on user role
  if (user?.role === 'instructor') {
    return <InstructorDashboard />;
  }
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return <AdminDashboard />;
  }
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
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [statsRes, enrollmentsRes] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/courses/enrolled/me')
        ]);
        setStats(statsRes.data);
        // Map actual user enrollments with real completion percentage
        const mappedCourses = (enrollmentsRes.data || []).map(e => ({
          id: e.course.id,
          title: e.course.title,
          slug: e.course.slug,
          difficulty: e.course.difficulty,
          short_description: e.course.short_description,
          progress: e.completion_percentage,
        }));
        setCourses(mappedCourses);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading Dashboard...</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Courses Enrolled', value: stats.total_courses_enrolled, icon: <FiBookOpen size={20} style={styles.statIcon} /> },
    { label: 'Study Hours', value: `${stats.total_study_hours}h`, icon: <FiClock size={20} style={styles.statIcon} /> },
    { label: 'Quiz Score Avg', value: `${stats.average_quiz_score}%`, icon: <FiTarget size={20} style={styles.statIcon} /> },
    { label: 'Current Streak', value: `${stats.current_streak} days`, icon: <FiActivity size={20} style={styles.statIcon} /> },
    { label: 'Problems Solved', value: stats.problems_solved, icon: <FiCode size={20} style={styles.statIcon} /> },
    { label: 'Certificates Earned', value: stats.certificates_earned, icon: <FiAward size={20} style={styles.statIcon} /> },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.welcomeRow}>
        <div>
          <h1 style={styles.welcomeTitle}>Welcome back, {user?.full_name || 'Student'}! 👋</h1>
          <p style={styles.welcomeSubtitle}>Track your learning path and practice coding questions today.</p>
        </div>
        <div style={styles.roleBadge}>{user?.role?.toUpperCase() || 'STUDENT'}</div>
      </div>

      {/* Stats Section */}
      <div style={styles.statsGrid}>
        {statCards.map((card, idx) => (
          <div key={idx} style={styles.statCard}>
            <div style={styles.statHeader}>
              <span style={styles.statValue}>{card.value}</span>
              {card.icon}
            </div>
            <span style={styles.statLabel}>{card.label}</span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 style={styles.sectionTitle}>Quick Actions</h2>
      <div style={styles.quickActionsRow}>
        <Link to="/courses" style={styles.actionCard}>
          <FiBookOpen size={24} style={styles.actionIcon} />
          <div>
            <h3 style={styles.actionTitle}>Continue Learning</h3>
            <p style={styles.actionDesc}>Resume where you left off in your modules.</p>
          </div>
        </Link>
        <Link to="/coding" style={styles.actionCard}>
          <FiCode size={24} style={styles.actionIcon} />
          <div>
            <h3 style={styles.actionTitle}>Coding Practice</h3>
            <p style={styles.actionDesc}>Solve programming exercises in the sandbox.</p>
          </div>
        </Link>
        <Link to="/ai-tutor" style={styles.actionCard}>
          <FiCpu size={24} style={styles.actionIcon} />
          <div>
            <h3 style={styles.actionTitle}>AI Tutor Chat</h3>
            <p style={styles.actionDesc}>Get direct assistance or concept breakdowns.</p>
          </div>
        </Link>
      </div>

      {/* Enrolled Courses */}
      <h2 style={styles.sectionTitle}>My Courses</h2>
      <div style={styles.coursesGrid}>
        {courses.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>You are not enrolled in any courses yet.</p>
            <Link to="/courses" style={styles.browseBtn}>Browse Courses</Link>
          </div>
        ) : (
          courses.slice(0, 3).map((course) => (
            <div key={course.id} style={styles.courseCard}>
              <div style={styles.courseHeader}>
                <h3 style={styles.courseTitle}>{course.title}</h3>
                <span style={styles.courseDifficulty}>{course.difficulty}</span>
              </div>
              <p style={styles.courseDesc}>{course.short_description || 'Master this topic with hands-on practice.'}</p>
              <div style={styles.progressRow}>
                <div style={styles.progressBarBg}>
                  <div style={{ ...styles.progressBarFill, width: `${course.progress || 0}%` }}></div>
                </div>
                <span style={styles.progressText}>{Math.round(course.progress || 0)}%</span>
              </div>
              <Link to={`/courses/${course.slug}`} style={styles.viewCourseLink}>Resume Course</Link>
            </div>
          ))
        )}
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
    fontSize: '1rem',
  },
  welcomeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2.5rem',
  },
  welcomeTitle: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
  },
  welcomeSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  roleBadge: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1.25rem',
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
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-semibold)',
  },
  statIcon: {
    color: 'var(--text-secondary)',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '1.25rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  quickActionsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginBottom: '3rem',
  },
  actionCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    transition: 'border-color var(--transition-fast)',
  },
  actionIcon: {
    color: 'var(--accent-primary)',
    marginTop: '0.25rem',
  },
  actionTitle: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-primary)',
    marginBottom: '0.25rem',
  },
  actionDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  coursesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  emptyState: {
    gridColumn: '1 / -1',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '3rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  emptyText: {
    color: 'var(--text-secondary)',
  },
  browseBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  courseCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  courseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  courseTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    lineHeight: '1.3',
  },
  courseDifficulty: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
  },
  courseDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
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
  viewCourseLink: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    textAlign: 'center',
    marginTop: '0.5rem',
  },
};
