import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
  FiBookOpen, FiClock, FiTarget, FiActivity,
  FiAward, FiCode, FiChevronRight,
  FiShield, FiArrowRight, FiUser, FiSliders, FiMessageSquare
} from 'react-icons/fi';
import PageLoader from '../components/common/PageLoader';
import PageHeader from '../components/common/PageHeader';
import SectionHeader from '../components/common/SectionHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import { useDashboardStats, useMyEnrollments } from '../hooks/useQueries';
import '../styles/pages/dashboard.css';

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

  const firstName = (user?.full_name || '').split(' ')[0];

  const renderActions = (actions) => (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="action-list">
        {actions.map((a) => (
          <Link key={a.title} to={a.to} className="action-row">
            <span className="stat-icon" data-tone="primary" aria-hidden="true">{a.icon}</span>
            <span className="action-row-body">
              <span className="action-row-title">{a.title}</span>
              <span className="action-row-desc">{a.desc}</span>
            </span>
            <FiChevronRight size={16} className="action-row-chevron" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );

  const renderCourseRow = ({ key, title, badge, description, progress, to, cta }) => (
    <div key={key} className="dash-course-row">
      <div className="dash-course-icon" aria-hidden="true"><FiBookOpen size={18} /></div>
      <div className="dash-course-body">
        <div className="dash-course-top">
          <h3 className="dash-course-title">{title}</h3>
          {badge && <span className="badge badge-neutral">{badge}</span>}
        </div>
        <p className="dash-course-desc">{description}</p>
        {progress !== undefined && (
          <div className="dash-course-progress">
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={Math.round(progress || 0)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${title} progress`}
            >
              <div className="progress-bar-fill" style={{ width: `${progress || 0}%` }} />
            </div>
            <span className="dash-course-pct">{Math.round(progress || 0)}%</span>
          </div>
        )}
      </div>
      <Link to={to} className="btn btn-secondary btn-sm">{cta}</Link>
    </div>
  );

  // 1. STUDENT VIEW
  if (role === 'student') {
    const statCards = [
      { label: 'Courses enrolled', value: stats.total_courses_enrolled, icon: <FiBookOpen size={16} /> },
      { label: 'Study hours', value: `${stats.total_study_hours}h`, icon: <FiClock size={16} /> },
      { label: 'Avg. quiz score', value: `${stats.average_quiz_score}%`, icon: <FiTarget size={16} /> },
      { label: 'Current streak', value: `${stats.current_streak} days`, icon: <FiActivity size={16} />, tone: 'warning' },
      { label: 'Problems solved', value: stats.problems_solved, icon: <FiCode size={16} /> },
      { label: 'Certificates', value: stats.certificates_earned, icon: <FiAward size={16} /> },
    ];

    return (
      <div className="page">
        <PageHeader
          eyebrow="Dashboard"
          title={`Welcome back${firstName ? `, ${firstName}` : ''}`}
          description="Track your learning path, test your skills, and maintain your study streak."
          actions={
            <>
              <Link to="/coding" className="btn btn-secondary"><FiCode size={15} /> Practice</Link>
              <Link to="/courses" className="btn btn-primary"><FiBookOpen size={15} /> Browse courses</Link>
            </>
          }
        />

        <div className="kpi-grid" data-cols="6">
          {statCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} tone={card.tone || 'primary'} />
          ))}
        </div>

        <div className="split">
          <section className="section">
            <SectionHeader
              title="Continue learning"
              description="Your enrolled courses"
              action={courses.length > 0 && (
                <Link to="/my-courses" className="section-link">View all <FiArrowRight size={14} /></Link>
              )}
            />
            {courses.length === 0 ? (
              <EmptyState
                icon={FiBookOpen}
                title="No courses yet"
                description="You are not enrolled in any courses yet. Start learning by exploring the catalog."
                action={<Link to="/courses" className="btn btn-primary">Browse Courses</Link>}
              />
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                {courses.slice(0, 3).map((course) => renderCourseRow({
                  key: course.id,
                  title: course.title,
                  badge: course.difficulty,
                  description: course.short_description || 'Master this topic with hands-on practice.',
                  progress: course.progress,
                  to: `/courses/${course.slug}`,
                  cta: 'Resume Course',
                }))}
              </div>
            )}
          </section>

          <aside className="section">
            <SectionHeader title="Quick actions" />
            {renderActions([
              { to: '/courses', icon: <FiBookOpen size={16} />, title: 'Continue Learning', desc: 'Resume where you left off in your modules.' },
              { to: '/coding', icon: <FiCode size={16} />, title: 'Coding Practice', desc: 'Solve programming challenges in the sandbox.' },
              { to: '/certificates', icon: <FiAward size={16} />, title: 'Certificates', desc: 'View and download accredited credentials.' },
            ])}
          </aside>
        </div>
      </div>
    );
  }

  // 2. INSTRUCTOR VIEW
  if (role === 'instructor') {
    const instructorCards = [
      { label: 'Active students', value: instructorStats.active_students, icon: <FiUser size={16} /> },
      { label: 'Completion rate', value: `${instructorStats.course_completion_rate}%`, icon: <FiActivity size={16} /> },
      { label: 'Quiz class avg.', value: `${instructorStats.average_quiz_score}%`, icon: <FiTarget size={16} /> },
      { label: 'Lecture watch rate', value: `${instructorStats.lecture_watch_rate}%`, icon: <FiClock size={16} /> },
    ];

    const rawName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'Instructor');
    const displayName = rawName.toLowerCase().startsWith('instructor') ? rawName : `Instructor ${rawName}`;

    return (
      <div className="page">
        <PageHeader
          eyebrow="Instructor"
          title={`Welcome back, ${displayName}`}
          description="Manage curriculum modules, check enrollment statistics, and reply to student doubts."
          badge={role}
        />

        <div className="callout">
          <div className="callout-main">
            <span className="page-header-icon" aria-hidden="true"><FiShield /></span>
            <div>
              <h3 className="callout-title">Instructor Curriculum Builder</h3>
              <p className="callout-text">Create coding problems, structure curriculum modules, and upload lecture videos.</p>
            </div>
          </div>
          <Link to="/instructor" className="btn btn-primary">
            Go to Instructor Panel <FiArrowRight size={15} />
          </Link>
        </div>

        <div className="kpi-grid">
          {instructorCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} tone="primary" />
          ))}
        </div>

        <div className="split">
          <section className="section">
            <SectionHeader title="My authored courses" description="Courses you publish and maintain" />
            {instructorStats.courses_list.length === 0 ? (
              <EmptyState
                icon={FiBookOpen}
                title="No courses yet"
                description="You haven't authored any courses yet. Create your first course to start teaching."
                action={<Link to="/instructor" className="btn btn-primary">Create Course</Link>}
              />
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                {instructorStats.courses_list.slice(0, 3).map((course) => renderCourseRow({
                  key: course.id,
                  title: course.title,
                  badge: `Course ID: #${course.id}`,
                  description: `Active Enrollments: ${course.enrollment_count} students`,
                  to: '/instructor',
                  cta: 'Configure Course',
                }))}
              </div>
            )}
          </section>

          <aside className="section">
            <SectionHeader title="Instructor quick actions" />
            {renderActions([
              { to: '/instructor', icon: <FiSliders size={16} />, title: 'Create / Edit Syllabus', desc: 'Manage course chapters, details, and video lectures.' },
              { to: '/analytics', icon: <FiActivity size={16} />, title: 'View Enrollment Charts', desc: 'Track completion metrics and quiz averages.' },
              { to: '/discussion', icon: <FiMessageSquare size={16} />, title: 'Resolve Forum Doubts', desc: 'Answer student queries on the Collaboration Hub.' },
            ])}
          </aside>
        </div>
      </div>
    );
  }

  // 3. ADMIN / SUPER ADMIN VIEW
  if (role === 'admin' || role === 'super_admin') {
    const adminCards = [
      { label: 'Total users', value: adminStats.total_users, icon: <FiUser size={16} /> },
      { label: 'Active courses', value: adminStats.total_courses, icon: <FiBookOpen size={16} /> },
      { label: 'Pending approvals', value: adminStats.pending_approval, icon: <FiAward size={16} />, tone: adminStats.pending_approval > 0 ? 'warning' : 'primary' },
      { label: 'Total enrollments', value: adminStats.total_enrollments, icon: <FiActivity size={16} /> },
    ];

    const rawName = user?.full_name || 'Admin';
    const displayName = rawName.toLowerCase().startsWith('admin') || rawName.toLowerCase().startsWith('administrator')
      ? rawName
      : `Administrator ${rawName}`;

    return (
      <div className="page">
        <PageHeader
          eyebrow="Administration"
          title={`Welcome back, ${displayName}`}
          description="Audit platform logs, update user authorization privileges, and monitor system metrics."
          badge={role.replace('_', ' ')}
        />

        <div className="callout">
          <div className="callout-main">
            <span className="page-header-icon" aria-hidden="true"><FiShield /></span>
            <div>
              <h3 className="callout-title">
                {role === 'super_admin' ? 'Executive Security Panel' : 'Admin Control Panel'}
              </h3>
              <p className="callout-text">
                {role === 'super_admin'
                  ? 'Suspend accounts, audit logs, or configure dynamic RBAC authorization policies.'
                  : 'Manage user accounts, review pending course approvals, and oversee platform operations.'}
              </p>
            </div>
          </div>
          <Link to={role === 'super_admin' ? '/admin-portal' : '/admin'} className="btn btn-primary">
            {role === 'super_admin' ? 'Go to Executive Portal' : 'Go to Admin Panel'} <FiArrowRight size={15} />
          </Link>
        </div>

        <div className="kpi-grid">
          {adminCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} tone={card.tone || 'primary'} />
          ))}
        </div>

        <div className="split">
          <section className="section">
            <SectionHeader title="System administration status" />
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="alert alert-success">
                <FiShield size={16} />
                <span>
                  Your root account is authenticated with full system-wide write privileges. Security logs and login attempts are logged in the audit ledger in real-time.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/admin-portal" className="btn btn-primary">Check Server Gauges</Link>
                <Link to="/admin" className="btn btn-secondary">View Privilege Matrix</Link>
              </div>
            </div>
          </section>

          <aside className="section">
            <SectionHeader title="Administrative actions" />
            {renderActions([
              { to: '/admin', icon: <FiUser size={16} />, title: 'User Registry Manager', desc: 'Suspend accounts, modify credentials, or reassign database roles.' },
              {
                to: role === 'super_admin' ? '/admin-portal' : '/admin',
                icon: <FiSliders size={16} />,
                title: role === 'super_admin' ? 'RBAC Matrix & Security' : 'User Roles & Access',
                desc: role === 'super_admin'
                  ? 'Configure dynamic permissions mapping and change global server settings.'
                  : 'Review user authorization status and access controls.',
              },
              { to: '/analytics', icon: <FiActivity size={16} />, title: 'Platform Statistics', desc: 'Track system signups and catalog distributions.' },
            ])}
          </aside>
        </div>
      </div>
    );
  }

  return null;
}
