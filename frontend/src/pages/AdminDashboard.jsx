import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiUsers, FiBookOpen, FiAlertCircle, FiSettings, FiCheck, FiTrash2, FiToggleLeft, FiToggleRight, FiVolume2 } from 'react-icons/fi';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    total_users: 0,
    active_users: 0,
    students: 0,
    instructors: 0,
    admins: 0,
    total_courses: 0,
    published_courses: 0,
    pending_approval: 0,
    total_enrollments: 0
  });

  const [users, setUsers] = useState([]);
  const [pendingCourses, setPendingCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', priority: 0 });

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  // Fetch admin overview stats, users list, pending courses, and announcements
  async function loadData() {
    setIsLoading(true);
    try {
      const [statsRes, usersRes, pendingRes, announceRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/users'),
        api.get('/admin/pending-courses'),
        api.get('/admin/announcements')
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data.items || []);
      setPendingCourses(pendingRes.data.items || []);
      setAnnouncements(announceRes.data || []);
    } catch (err) {
      toast.error('Failed to load admin dashboard data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveCourse = async (courseId) => {
    setIsActioning(true);
    try {
      await api.patch(`/courses/${courseId}/approve`);
      toast.success('Course approved successfully!');
      loadData();
    } catch (err) {
      toast.error('Failed to approve course');
    } finally {
      setIsActioning(false);
    }
  };

  const handleToggleUserActive = async (userId) => {
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      toast.success('User status updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/users/${userId}/role?role=${newRole}`);
      toast.success('User role updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted successfully');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPass = window.prompt('Enter new password (minimum 12 characters, must include uppercase, lowercase, number, and special character):');
    if (!newPass) return;
    
    if (newPass.length < 12) {
      toast.error('Password must be at least 12 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/\d/.test(newPass) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPass)) {
      toast.error('Password must contain uppercase, lowercase, number, and special character');
      return;
    }

    try {
      await api.patch(`/users/${userId}/reset-password?new_password=${encodeURIComponent(newPass)}`);
      toast.success('User password updated successfully!');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast.error('Please enter title and content');
      return;
    }

    try {
      await api.post('/admin/announcements', newAnnouncement);
      toast.success('Announcement published');
      setNewAnnouncement({ title: '', content: '', priority: 0 });
      loadData();
    } catch (err) {
      toast.error('Failed to create announcement');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    try {
      await api.delete(`/admin/announcements/${id}`);
      toast.success('Announcement deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete announcement');
    }
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Configuring administrator context...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Admin Panel</h1>
        <p style={styles.subtitle}>Manage users, review course publications, and dispatch site announcements.</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabsRow}>
        <button
          onClick={() => setActiveTab('overview')}
          style={activeTab === 'overview' ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          System Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={activeTab === 'users' ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          User Management ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          style={activeTab === 'courses' ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          Pending Reviews ({pendingCourses.length})
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          style={activeTab === 'announcements' ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          Announcements ({announcements.length})
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={styles.tabContent}>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.total_users}</span>
              <span style={styles.statLabel}>Total Registrants</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.instructors}</span>
              <span style={styles.statLabel}>Instructors</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.total_courses}</span>
              <span style={styles.statLabel}>Active Courses</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{stats.pending_approval}</span>
              <span style={styles.statLabel}>Awaiting Approval</span>
            </div>
          </div>
        </div>
      )}

      {/* Users Management Tab */}
      {activeTab === 'users' && (
        <div style={styles.tabContent}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tr}>
                <th style={styles.th}>Full Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Username</th>
                <th style={styles.th}>Password Hash</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>{u.full_name}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>{u.username}</td>
                  <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', opacity: 0.8 }} title={u.password_hash}>
                    {u.password_hash ? `${u.password_hash.substring(0, 12)}...` : 'N/A'}
                  </td>
                  <td style={styles.td}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      style={styles.inlineSelect}
                    >
                      <option value="student">Student</option>
                      <option value="instructor">Instructor</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleToggleUserActive(u.id)}
                      style={styles.toggleStatusBtn}
                    >
                      {u.is_active ? (
                        <span style={styles.activeText}><FiToggleRight /> Active</span>
                      ) : (
                        <span style={styles.inactiveText}><FiToggleLeft /> Suspended</span>
                      )}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionsCell}>
                      <button onClick={() => handleResetPassword(u.id)} style={styles.resetPassBtn}>
                        Reset Pass
                      </button>
                      <button onClick={() => handleDeleteUser(u.id)} style={styles.deleteUserBtn}>
                        <FiTrash2 /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Course Approval Reviews Tab */}
      {activeTab === 'courses' && (
        <div style={styles.tabContent}>
          {pendingCourses.length === 0 ? (
            <div style={styles.emptyState}>
              <FiBookOpen size={48} />
              <p>No courses pending approval review at the moment.</p>
            </div>
          ) : (
            <div style={styles.listGrid}>
              {pendingCourses.map((c) => (
                <div key={c.id} style={styles.pendingCard}>
                  <h3 style={styles.pendingTitle}>{c.title}</h3>
                  <p style={styles.pendingDesc}>{c.short_description || 'New publication syllabus submission.'}</p>
                  <button
                    onClick={() => handleApproveCourse(c.id)}
                    disabled={isActioning}
                    style={styles.approveBtn}
                  >
                    <FiCheck /> Approve Publication
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div style={styles.tabContentAnnounce}>
          <form onSubmit={handleCreateAnnouncement} style={styles.announceForm}>
            <h3 style={styles.sectionHeading}>Publish Site Announcement</h3>
            <input
              type="text"
              placeholder="Announcement Title"
              value={newAnnouncement.title}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              style={styles.input}
              required
            />
            <textarea
              placeholder="Write announcement body message here..."
              value={newAnnouncement.content}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
              style={styles.textarea}
              required
            />
            <button type="submit" style={styles.submitBtn}>
              Publish Announcement
            </button>
          </form>

          <div style={styles.announceList}>
            <h3 style={styles.sectionHeading}>Active Announcements</h3>
            {announcements.length === 0 ? (
              <p style={styles.noAnnounce}>No announcements published yet.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} style={styles.announceCard}>
                  <div style={styles.announceHeader}>
                    <h4 style={styles.announceTitle}>{a.title}</h4>
                    <button onClick={() => handleDeleteAnnouncement(a.id)} style={styles.deleteAnnounceBtn}>
                      <FiTrash2 />
                    </button>
                  </div>
                  <p style={styles.announceBody}>{a.content}</p>
                </div>
              ))
            )}
          </div>
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
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  tabsRow: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '1px',
    marginBottom: '2.5rem',
    overflowX: 'auto',
  },
  tabBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
    cursor: 'pointer',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  },
  activeTab: {
    color: 'var(--accent-primary)',
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-primary) var(--border-primary) var(--bg-card)',
  },
  tabContent: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    overflowX: 'auto',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
  },
  statCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
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
  inlineSelect: {
    padding: '0.375rem 0.5rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  toggleStatusBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  activeText: {
    color: 'var(--color-success)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  inactiveText: {
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  deleteUserBtn: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    color: 'var(--color-error)',
    border: '1px solid rgba(231, 76, 60, 0.2)',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  resetPassBtn: {
    backgroundColor: 'rgba(54, 162, 235, 0.1)',
    color: 'var(--color-link)',
    border: '1px solid rgba(54, 162, 235, 0.2)',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  actionsCell: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  listGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
  },
  pendingCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  pendingTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
  },
  pendingDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    flex: 1,
  },
  approveBtn: {
    backgroundColor: 'var(--color-success)',
    color: '#FFF',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    border: 'none',
  },
  tabContentAnnounce: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 2fr',
    gap: '3rem',
  },
  announceForm: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    height: 'fit-content',
  },
  sectionHeading: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
    marginBottom: '0.25rem',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  textarea: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    minHeight: '120px',
    resize: 'vertical',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  announceList: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  noAnnounce: {
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  announceCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  announceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  announceTitle: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
  },
  deleteAnnounceBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-error)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  announceBody: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
};
