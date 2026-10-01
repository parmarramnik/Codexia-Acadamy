import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiUser, FiActivity, FiAward, FiBookOpen, FiCode, FiEdit2, FiExternalLink, FiShield } from 'react-icons/fi';
import PageLoader from '../components/common/PageLoader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import '../styles/pages/profile.css';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  instructor: 'Instructor',
  student: 'Student',
};

export default function Profile() {
  const { user } = useAuth();
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
  const [certificates, setCertificates] = useState([]);
  const [instructorCourses, setInstructorCourses] = useState([]);
  const [adminStats, setAdminStats] = useState({
    total_users: 0,
    active_users: 0,
    total_courses: 0,
    published_courses: 0,
    pending_approval: 0,
    total_enrollments: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isInstructor = user?.role === 'instructor';

  const getFullCertUrl = (relativeUrl) => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    const backendHost = api.defaults.baseURL.replace(/\/api$/, '');
    return `${backendHost}${relativeUrl}`;
  };

  useEffect(() => {
    async function loadProfileData() {
      try {
        if (user?.role === 'admin' || user?.role === 'super_admin') {
          const statsRes = await api.get('/admin/stats');
          setAdminStats(statsRes.data);
        } else if (user?.role === 'instructor') {
          const res = await api.get('/courses/instructor/me');
          setInstructorCourses(res.data.items || []);
        } else {
          const [statsRes, certsRes] = await Promise.all([
            api.get('/analytics/dashboard'),
            api.get('/certificates')
          ]);
          setStats(statsRes.data);
          setCertificates(certsRes.data || []);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load profile details');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfileData();
  }, [user?.role]);

  if (isLoading) {
    return <PageLoader />;
  }

  // Fallback avatar generator using UI Avatars
  const avatarUrl = user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'User')}&background=6366F1&color=FFFFFF&size=128&bold=true`;
  const roleLabel = ROLE_LABELS[user?.role] || user?.role;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  const statCards = isAdmin
    ? [
        { label: 'Total users', value: adminStats.total_users, icon: <FiUser size={16} /> },
        { label: 'Active courses', value: adminStats.total_courses, icon: <FiBookOpen size={16} /> },
        { label: 'Pending approvals', value: adminStats.pending_approval, icon: <FiAward size={16} /> },
        { label: 'Total enrollments', value: adminStats.total_enrollments, icon: <FiActivity size={16} /> },
      ]
    : isInstructor
    ? [
        { label: 'Courses authored', value: instructorCourses.length, icon: <FiBookOpen size={16} /> },
        { label: 'Total students', value: instructorCourses.reduce((acc, c) => acc + (c.enrollment_count || 0), 0), icon: <FiUser size={16} /> },
      ]
    : [
        { label: 'Enrolled courses', value: stats.total_courses_enrolled, icon: <FiBookOpen size={16} /> },
        { label: 'Problems solved', value: stats.problems_solved, icon: <FiCode size={16} /> },
        { label: 'Current streak', value: `${stats.current_streak} days`, icon: <FiActivity size={16} /> },
        { label: 'Certificates', value: certificates.length, icon: <FiAward size={16} /> },
      ];

  return (
    <div className="page profile-page">
      {/* Identity */}
      <section className="card profile-hero">
        <img src={avatarUrl} alt="" className="profile-avatar" loading="lazy" />
        <div className="profile-identity">
          <div className="profile-name-row">
            <h1 className="profile-name">{user?.full_name}</h1>
            <span className="badge badge-primary">{roleLabel}</span>
          </div>
          <p className="profile-handle">
            {user?.username && <span>@{user.username}</span>}
            {user?.username && user?.email && <span aria-hidden="true">·</span>}
            {user?.email && <span>{user.email}</span>}
          </p>
          {user?.bio && <p className="profile-bio">{user.bio}</p>}
        </div>
        <Link to="/settings" className="btn btn-secondary profile-edit">
          <FiEdit2 size={14} /> Edit profile
        </Link>
      </section>

      {/* Key numbers */}
      <div className="kpi-grid" style={statCards.length === 2 ? { '--cols': 2 } : undefined}>
        {statCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} tone="primary" />
        ))}
      </div>

      <div className="split">
        {/* Main column */}
        <section className="section">
          {isAdmin ? (
            <>
              <div className="section-header">
                <h2 className="section-title">Administrative access</h2>
              </div>
              <div className="card card-pad profile-admin">
                <div className="alert alert-info">
                  <FiShield size={16} />
                  <span>
                    Your account has <strong>{roleLabel}</strong> permissions for management controls, security logs, and course moderation.
                  </span>
                </div>
                <div className="profile-admin-actions">
                  <Link to="/admin" className="btn btn-primary">Go to Admin Panel</Link>
                  {user?.role === 'super_admin' && (
                    <Link to="/admin-portal" className="btn btn-secondary">Go to Executive Portal</Link>
                  )}
                </div>
              </div>
            </>
          ) : isInstructor ? (
            <>
              <div className="section-header">
                <h2 className="section-title">Authored courses</h2>
              </div>
              {instructorCourses.length === 0 ? (
                <EmptyState
                  icon={FiBookOpen}
                  title="No courses yet"
                  description="You haven't authored any courses yet. Go to your panel to create one."
                  action={<Link to="/instructor" className="btn btn-primary">Go to Instructor Panel</Link>}
                />
              ) : (
                <div className="card profile-list">
                  {instructorCourses.map((course) => (
                    <div key={course.id} className="profile-list-row">
                      <span className="stat-icon" aria-hidden="true"><FiBookOpen size={16} /></span>
                      <div className="profile-list-body">
                        <span className="profile-list-title">{course.title}</span>
                        <span className="profile-list-meta">
                          {(course.category || '').replace('_', ' ')} · {course.difficulty} · {course.enrollment_count || 0} students
                        </span>
                      </div>
                      <Link to={`/courses/${course.slug}`} className="btn btn-ghost btn-sm">
                        View <FiExternalLink size={13} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-header">
                <h2 className="section-title">Certificates</h2>
                {certificates.length > 0 && <Link to="/certificates" className="section-link">Manage</Link>}
              </div>
              {certificates.length === 0 ? (
                <EmptyState
                  icon={FiAward}
                  title="No certificates yet"
                  description="Complete courses to unlock verified credentials."
                  action={<Link to="/courses" className="btn btn-primary">Browse Courses</Link>}
                />
              ) : (
                <div className="card profile-list">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="profile-list-row">
                      <span className="stat-icon" aria-hidden="true"><FiAward size={16} /></span>
                      <div className="profile-list-body">
                        <span className="profile-list-title">{cert.course_title}</span>
                        <span className="profile-list-meta">
                          {cert.completion_date && !Number.isNaN(new Date(cert.completion_date).getTime()) && (
                            <>Issued {new Date(cert.completion_date).toLocaleDateString()} · </>
                          )}
                          <span className="mono">{cert.certificate_uid}</span>
                        </span>
                      </div>
                      <a
                        href={getFullCertUrl(cert.certificate_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Verify <FiExternalLink size={13} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Side column */}
        <aside className="section">
          <div className="section-header">
            <h2 className="section-title">Account</h2>
          </div>
          <div className="card">
            <dl className="profile-details">
              <div><dt>Full name</dt><dd>{user?.full_name || '—'}</dd></div>
              {user?.username && <div><dt>Username</dt><dd>@{user.username}</dd></div>}
              <div><dt>Email</dt><dd>{user?.email || '—'}</dd></div>
              <div><dt>Role</dt><dd>{roleLabel}</dd></div>
              {memberSince && <div><dt>Member since</dt><dd>{memberSince}</dd></div>}
            </dl>
          </div>

        </aside>
      </div>
    </div>
  );
}
