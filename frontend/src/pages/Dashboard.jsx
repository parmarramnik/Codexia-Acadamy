import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiBookOpen, FiClock, FiTarget, FiActivity, 
  FiAward, FiCode, FiCpu, FiCalendar, 
  FiShield, FiArrowRight, FiUser, FiSliders, FiMessageSquare 
} from 'react-icons/fi';
import PageLoader from '../components/common/PageLoader';
import { useDashboardStats, useMyEnrollments } from '../hooks/useQueries';

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || 'student';

  const [isLoading, setIsLoading] = useState(true);

  // TanStack Query for Student caching
  const { data: dashboardData, isLoading: isStatsLoading } = useDashboardStats();
  const { data: enrollmentsData, isLoading: isEnrollmentsLoading } = useMyEnrollments();

  // Student states
  const stats = dashboardData || {
    total_courses_enrolled: 0,
    completed_courses: 0,
    total_study_hours: 0,
    quizzes_taken: 0,
    average_quiz_score: 0,
    problems_solved: 0,
    current_streak: 0,
    certificates_earned: 0,
  };

  const courses = (enrollmentsData || []).map(e => ({
    id: e.course?.id || e.course_id,
    title: e.course?.title,
    slug: e.course?.slug,
    difficulty: e.course?.difficulty,
    short_description: e.course?.short_description,
    progress: e.completion_percentage,
  }));

  // Instructor states
  const [instructorStats, setInstructorStats] = useState({
    active_students: 0,
    course_completion_rate: 0.0,
    average_quiz_score: 0.0,
    lecture_watch_rate: 0.0,
    courses_list: []
  });

  // Admin / Super Admin states
  const [adminStats, setAdminStats] = useState({
    total_users: 0,
    active_users: 0,
    total_courses: 0,
    published_courses: 0,
    pending_approval: 0,
    total_enrollments: 0
  });

  useEffect(() => {
    async function fetchDashboardData() {
      if (role === 'student') {
        setIsLoading(false);
        return;
      }
      try {
        if (role === 'instructor') {
          const res = await api.get('/analytics/instructor');
          setInstructorStats(res.data || {
            active_students: 0,
            course_completion_rate: 0.0,
            average_quiz_score: 0.0,
            lecture_watch_rate: 0.0,
            courses_list: []
          });
        } else if (role === 'admin' || role === 'super_admin') {
          const res = await api.get('/admin/stats');
          setAdminStats(res.data || {
            total_users: 0,
            active_users: 0,
            total_courses: 0,
            published_courses: 0,
            pending_approval: 0,
            total_enrollments: 0
          });
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, [role]);

  const effectiveLoading = role === 'student' ? (isStatsLoading && !dashboardData) : isLoading;

  if (effectiveLoading) {
    return <PageLoader />;
  }

  // --- RENDERING BASED ON ROLE ---

  // 1. STUDENT VIEW
  if (role === 'student') {
    const statCards = [
      { label: 'Courses Enrolled', value: stats.total_courses_enrolled, icon: <FiBookOpen size={18} />, color: '#818CF8', bg: 'rgba(99, 102, 241, 0.12)' },
      { label: 'Study Hours', value: `${stats.total_study_hours}h`, icon: <FiClock size={18} />, color: '#34D399', bg: 'rgba(16, 185, 129, 0.12)' },
      { label: 'Quiz Score Avg', value: `${stats.average_quiz_score}%`, icon: <FiTarget size={18} />, color: '#38BDF8', bg: 'rgba(6, 182, 212, 0.12)' },
      { label: 'Current Streak', value: `${stats.current_streak} days`, icon: <FiActivity size={18} />, color: '#FBBF24', bg: 'rgba(245, 158, 11, 0.12)' },
      { label: 'Problems Solved', value: stats.problems_solved, icon: <FiCode size={18} />, color: '#A78BFA', bg: 'rgba(139, 92, 246, 0.12)' },
      { label: 'Certificates Earned', value: stats.certificates_earned, icon: <FiAward size={18} />, color: '#FB7185', bg: 'rgba(244, 63, 94, 0.12)' },
    ];

    return (
      <div style={styles.container}>
        <div style={styles.welcomeRow}>
          <div>
            <h1 style={styles.welcomeTitle}>Welcome back, {user?.full_name || 'Student'}! 👋</h1>
            <p style={styles.welcomeSubtitle}>Track your learning path, test your skills, and maintain your study streak.</p>
          </div>
          <div style={{
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            color: '#818CF8',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>{role}</div>
        </div>

        <div style={styles.statsGrid}>
          {statCards.map((card, idx) => (
            <div key={idx} style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={styles.statValue}>{card.value}</span>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: card.bg,
                  color: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {card.icon}
                </div>
              </div>
              <span style={styles.statLabel}>{card.label}</span>
            </div>
          ))}
        </div>

        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.quickActionsRow}>
          <Link to="/courses" style={styles.actionCard}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              color: '#34D399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FiBookOpen size={20} />
            </div>
            <div>
              <h3 style={styles.actionTitle}>Continue Learning</h3>
              <p style={styles.actionDesc}>Resume where you left off in your modules.</p>
            </div>
          </Link>
          <Link to="/coding" style={styles.actionCard}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FiCode size={20} />
            </div>
            <div>
              <h3 style={styles.actionTitle}>Coding Practice</h3>
              <p style={styles.actionDesc}>Solve programming challenges in the sandbox.</p>
            </div>
          </Link>
          <Link to="/certificates" style={styles.actionCard}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FiAward size={20} />
            </div>
            <div>
              <h3 style={styles.actionTitle}>Certificates</h3>
              <p style={styles.actionDesc}>View and download accredited credentials.</p>
            </div>
          </Link>
        </div>

        <h2 style={styles.sectionTitle}>My Enrolled Courses</h2>
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

  // 2. INSTRUCTOR VIEW
  if (role === 'instructor') {
    const instructorCards = [
      { label: 'Active Students', value: instructorStats.active_students, icon: <FiUser size={20} style={styles.statIcon} /> },
      { label: 'Completion Rate', value: `${instructorStats.course_completion_rate}%`, icon: <FiActivity size={20} style={styles.statIcon} /> },
      { label: 'Quiz Class Avg', value: `${instructorStats.average_quiz_score}%`, icon: <FiTarget size={20} style={styles.statIcon} /> },
      { label: 'Lecture Watch Rate', value: `${instructorStats.lecture_watch_rate}%`, icon: <FiClock size={20} style={styles.statIcon} /> },
    ];

    const rawName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Instructor');
    const displayName = rawName.toLowerCase().startsWith('instructor') ? rawName : `Instructor ${rawName}`;

    return (
      <div style={styles.container}>
        <div style={styles.welcomeRow}>
          <div>
            <h1 style={styles.welcomeTitle}>Welcome back, {displayName}! 🎓</h1>
            <p style={styles.welcomeSubtitle}>Manage curriculum modules, check enrollment statistics, and reply to student doubts.</p>
          </div>
          <div style={styles.roleBadge}>{role.toUpperCase()}</div>
        </div>

        <div style={styles.roleBanner}>
          <div style={styles.roleBannerLeft}>
            <FiShield size={24} style={styles.roleBannerIcon} />
            <div>
              <h3 style={styles.roleBannerTitle}>Instructor Curriculum Builder</h3>
              <p style={styles.roleBannerText}>Create coding problems, structure curriculum modules, and upload lecture videos.</p>
            </div>
          </div>
          <Link to="/instructor" style={styles.roleBannerBtn}>
            Go to Instructor Panel <FiArrowRight size={16} style={{ marginLeft: '6px' }} />
          </Link>
        </div>

        <div style={styles.statsGrid}>
          {instructorCards.map((card, idx) => (
            <div key={idx} style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={styles.statValue}>{card.value}</span>
                {card.icon}
              </div>
              <span style={styles.statLabel}>{card.label}</span>
            </div>
          ))}
        </div>

        <h2 style={styles.sectionTitle}>Instructor Quick Actions</h2>
        <div style={styles.quickActionsRow}>
          <Link to="/instructor" style={styles.actionCard}>
            <FiSliders size={24} style={styles.actionIcon} />
            <div>
              <h3 style={styles.actionTitle}>Create / Edit Syllabus</h3>
              <p style={styles.actionDesc}>Manage course chapters, details, and video lectures.</p>
            </div>
          </Link>
          <Link to="/analytics" style={styles.actionCard}>
            <FiActivity size={24} style={styles.actionIcon} />
            <div>
              <h3 style={styles.actionTitle}>View Enrollment Charts</h3>
              <p style={styles.actionDesc}>Track completion metrics and quiz averages.</p>
            </div>
          </Link>
          <Link to="/discussion" style={styles.actionCard}>
            <FiMessageSquare size={24} style={styles.actionIcon} />
            <div>
              <h3 style={styles.actionTitle}>Resolve Forum Doubts</h3>
              <p style={styles.actionDesc}>Answer student queries on the Collaboration Hub.</p>
            </div>
          </Link>
        </div>

        <h2 style={styles.sectionTitle}>My Authored Courses</h2>
        <div style={styles.coursesGrid}>
          {instructorStats.courses_list.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>You haven't authored any courses yet.</p>
              <Link to="/instructor" style={styles.browseBtn}>Create Course</Link>
            </div>
          ) : (
            instructorStats.courses_list.slice(0, 3).map((course) => (
              <div key={course.id} style={styles.courseCard}>
                <div style={styles.courseHeader}>
                  <h3 style={styles.courseTitle}>{course.title}</h3>
                  <span style={styles.courseDifficulty}>Course ID: #{course.id}</span>
                </div>
                <p style={styles.courseDesc}>Check your student enrollment ledger and build out this syllabus structure.</p>
                <div style={styles.progressRow}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Active Enrollments: <strong>{course.enrollment_count}</strong> students
                  </span>
                </div>
                <Link to="/instructor" style={styles.viewCourseLink}>Configure Course</Link>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 3. ADMIN / SUPER ADMIN VIEW
  if (role === 'admin' || role === 'super_admin') {
    const adminCards = [
      { label: 'Total Users', value: adminStats.total_users, icon: <FiUser size={20} style={styles.statIcon} /> },
      { label: 'Active Courses', value: adminStats.total_courses, icon: <FiBookOpen size={20} style={styles.statIcon} /> },
      { label: 'Pending Approvals', value: adminStats.pending_approval, icon: <FiAward size={20} style={styles.statIcon} /> },
      { label: 'Total Enrollments', value: adminStats.total_enrollments, icon: <FiActivity size={20} style={styles.statIcon} /> },
    ];

    const rawName = user?.full_name || 'Admin';
    const displayName = rawName.toLowerCase().startsWith('admin') || rawName.toLowerCase().startsWith('administrator')
      ? rawName
      : `Administrator ${rawName}`;

    return (
      <div style={styles.container}>
        <div style={styles.welcomeRow}>
          <div>
            <h1 style={styles.welcomeTitle}>Welcome back, {displayName}! 🛡️</h1>
            <p style={styles.welcomeSubtitle}>Audit platform logs, update user authorization privileges, and monitor system metrics.</p>
          </div>
          <div style={styles.roleBadge}>{role.toUpperCase()}</div>
        </div>

        <div style={styles.roleBanner}>
          <div style={styles.roleBannerLeft}>
            <FiShield size={24} style={styles.roleBannerIcon} />
            <div>
              <h3 style={styles.roleBannerTitle}>
                {role === 'super_admin' ? 'Executive Security Panel' : 'Admin Control Panel'}
              </h3>
              <p style={styles.roleBannerText}>
                {role === 'super_admin'
                  ? 'Suspend accounts, audit logs, or configure dynamic RBAC authorization policies.'
                  : 'Manage user accounts, review pending course approvals, and oversee platform operations.'}
              </p>
            </div>
          </div>
          <Link to={role === 'super_admin' ? '/admin-portal' : '/admin'} style={styles.roleBannerBtn}>
            {role === 'super_admin' ? 'Go to Executive Portal' : 'Go to Admin Panel'} <FiArrowRight size={16} style={{ marginLeft: '6px' }} />
          </Link>
        </div>

        <div style={styles.statsGrid}>
          {adminCards.map((card, idx) => (
            <div key={idx} style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={styles.statValue}>{card.value}</span>
                {card.icon}
              </div>
              <span style={styles.statLabel}>{card.label}</span>
            </div>
          ))}
        </div>

        <h2 style={styles.sectionTitle}>Administrative Actions</h2>
        <div style={styles.quickActionsRow}>
          <Link to="/admin" style={styles.actionCard}>
            <FiUser size={24} style={styles.actionIcon} />
            <div>
              <h3 style={styles.actionTitle}>User Registry Manager</h3>
              <p style={styles.actionDesc}>Suspend accounts, modify credentials, or reassign database roles.</p>
            </div>
          </Link>
          <Link to={role === 'super_admin' ? '/admin-portal' : '/admin'} style={styles.actionCard}>
            <FiSliders size={24} style={styles.actionIcon} />
            <div>
              <h3 style={styles.actionTitle}>
                {role === 'super_admin' ? 'RBAC Matrix & Security' : 'User Roles & Access'}
              </h3>
              <p style={styles.actionDesc}>
                {role === 'super_admin'
                  ? 'Configure dynamic permissions mapping and change global server settings.'
                  : 'Review user authorization status and access controls.'}
              </p>
            </div>
          </Link>
          <Link to="/analytics" style={styles.actionCard}>
            <FiActivity size={24} style={styles.actionIcon} />
            <div>
              <h3 style={styles.actionTitle}>Platform Statistics</h3>
              <p style={styles.actionDesc}>Track system signups and catalog distributions.</p>
            </div>
          </Link>
        </div>

        <h2 style={styles.sectionTitle}>System Administration Status</h2>
        <div style={{ ...styles.emptyState, padding: '2rem', textAlign: 'left', alignItems: 'flex-start' }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
            Your root account is authenticated with full system-wide write privileges. Security logs and login attempts are logged in the audit ledger in real-time.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/admin-portal" style={styles.browseBtn}>Check Server Gauges</Link>
            <Link to="/admin" style={{ ...styles.viewCourseLink, marginTop: 0 }}>View Privilege Matrix</Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  container: {
    padding: '0 0 2.5rem 0',
    maxWidth: '100%',
    margin: '0',
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
    gap: '1rem',
    flexWrap: 'wrap',
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
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all var(--transition-base)',
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
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    transition: 'all var(--transition-base)',
    textDecoration: 'none',
    boxShadow: 'var(--shadow-sm)',
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
    color: '#1A1A1A',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    textDecoration: 'none',
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
    textDecoration: 'none',
  },
  roleBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 161, 22, 0.05)',
    border: '1px solid rgba(255, 161, 22, 0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem 1.5rem',
    marginBottom: '2rem',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  roleBannerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flex: 1,
    minWidth: '280px',
  },
  roleBannerIcon: {
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  roleBannerTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
    marginBottom: '0.25rem',
  },
  roleBannerText: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  roleBannerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--accent-primary)',
    color: '#1A1A1A',
    fontWeight: 'var(--fw-bold)',
    fontSize: '0.875rem',
    padding: '0.65rem 1.25rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
};
