import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiShield, 
  FiUsers, 
  FiCpu, 
  FiDatabase, 
  FiDownload, 
  FiSliders, 
  FiActivity,
  FiSearch,
  FiEdit,
  FiCheckCircle,
  FiAlertTriangle
} from 'react-icons/fi';

export default function AdminPortal() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  
  // User Management
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  
  // RBAC Roles/Permissions
  const [rbacMap, setRbacMap] = useState({});
  const [permissionsList] = useState([
    "user_suspend", "user_delete", "course_publish", "analytics_view", "system_settings_edit"
  ]);

  // System Settings
  const [settings, setSettings] = useState({});
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, healthRes, usersRes, rbacRes, settingsRes] = await Promise.all([
        api.get('/admin/dashboard/stats'),
        api.get('/admin/health'),
        api.get('/admin/users', { params: { skip: userPage * 10, limit: 10, search: userSearch } }),
        api.get('/admin/rbac/roles'),
        api.get('/admin/settings')
      ]);
      setStats(statsRes.data.kpis);
      setHealth(healthRes.data);
      setUsers(usersRes.data.items || []);
      setTotalUsers(usersRes.data.total || 0);
      setRbacMap(rbacRes.data || {});
      setSettings(settingsRes.data || {});
    } catch (err) {
      toast.error('Forbidden: You need Administrator privileges to view this portal.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userPage, userSearch]);

  // Suspend/Activate User
  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, null, {
        params: { is_active: !currentStatus }
      });
      toast.success(currentStatus ? 'User account suspended.' : 'User account re-activated.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user status.');
    }
  };

  // Change User Role
  const handleChangeRole = async (userId, targetRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, null, {
        params: { role: targetRole }
      });
      toast.success('User role updated successfully.');
      loadData();
    } catch (err) {
      toast.error('Failed to change user role.');
    }
  };

  // Toggle RBAC Permission Link
  const handleTogglePermission = async (roleName, permName) => {
    try {
      const res = await api.post(`/admin/rbac/roles/${roleName}/permissions`, null, {
        params: { permission_name: permName }
      });
      toast.success(res.data.status === 'added' ? `Granted ${permName} to ${roleName}` : `Revoked ${permName} from ${roleName}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update permission mapping.');
    }
  };

  // Save Settings
  const handleSaveSetting = async (key, val) => {
    try {
      await api.patch('/admin/settings', null, { params: { key, value: val } });
      toast.success(`System Setting '${key}' updated.`);
      loadData();
    } catch (err) {
      toast.error('Failed to save settings.');
    }
  };

  // Export report
  const handleExport = (reportType) => {
    const url = `${api.defaults.baseURL || ''}/admin/reports/export?report_type=${reportType}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={{ color: 'var(--text-secondary)' }}>Gathering executive cluster indicators...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Title */}
      <div style={styles.header}>
        <h1 style={styles.title}><FiShield style={{ color: 'var(--accent-primary)', marginRight: '8px' }} /> Executive Admin Center</h1>
        <p style={styles.subtitle}>Audit user privileges, configure Dynamic RBAC mapping overrides, edit server settings, and check server hardware gauges.</p>
      </div>

      {/* Stats KPIs row */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Active Sessions</span>
          <div style={styles.statValue}>{stats?.active_users || 0}</div>
          <span style={styles.statFoot}>Live sockets connected</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>CPU Utilization</span>
          <div style={styles.statValue}>{health?.cpu_percent || 0}%</div>
          <span style={styles.statFoot}>Server load average</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>RAM Consumption</span>
          <div style={styles.statValue}>{health?.memory_percent || 0}%</div>
          <span style={styles.statFoot}>Platform heap utilization</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Certificates Issued</span>
          <div style={styles.statValue}>{stats?.certificates_issued || 0}</div>
          <span style={styles.statFoot}>Public credential registries</span>
        </div>
      </div>

      <div style={styles.workspaceGrid}>
        
        {/* User Management Panel */}
        <div style={styles.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={styles.panelTitle}><FiUsers /> User Registry</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
              <input 
                type="text"
                placeholder="Search name/email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                style={styles.searchInput}
                aria-label="Search users"
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table} aria-label="User Management Table">
              <thead>
                <tr style={styles.tr}>
                  <th style={styles.th}>Username</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>{u.username}</td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>
                      <select 
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        style={styles.selectSmall}
                        aria-label={`Change role for ${u.username}`}
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: u.is_active ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 'bold' }}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button 
                        onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                        style={u.is_active ? styles.suspendBtn : styles.activateBtn}
                        aria-label={u.is_active ? `Suspend ${u.username}` : `Activate ${u.username}`}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem' }}>
            <button 
              disabled={userPage === 0} 
              onClick={() => setUserPage(userPage - 1)}
              style={styles.pageBtn}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Page {userPage + 1} of {Math.ceil(totalUsers / 10) || 1}</span>
            <button 
              disabled={(userPage + 1) * 10 >= totalUsers} 
              onClick={() => setUserPage(userPage + 1)}
              style={styles.pageBtn}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>

        {/* Dynamic RBAC Matrix Panel */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}><FiShield /> Dynamic RBAC Authorization Matrix</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Map granular access permissions dynamically. Checks are enforced in database lookups.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table} aria-label="RBAC Authorization Matrix">
              <thead>
                <tr style={styles.tr}>
                  <th style={styles.th}>Permission</th>
                  {Object.keys(rbacMap).map(role => (
                    <th key={role} style={styles.th}>{role.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionsList.map(perm => (
                  <tr key={perm} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{perm}</td>
                    {Object.keys(rbacMap).map(role => {
                      const hasPerm = rbacMap[role]?.includes(perm);
                      return (
                        <td key={role} style={styles.td}>
                          <input 
                            type="checkbox"
                            checked={hasPerm}
                            onChange={() => handleTogglePermission(role, perm)}
                            aria-label={`Toggle ${perm} permission for ${role}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settings & Reports Panel */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}><FiSliders /> Configuration & Reports</h3>
          
          {/* Settings CRUD */}
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>System Settings</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {Object.keys(settings).map(key => (
              <div key={key} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{key}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input 
                    type="text" 
                    value={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    style={styles.settingInput}
                    aria-label={`System setting ${key}`}
                  />
                  <button 
                    onClick={() => handleSaveSetting(key, settings[key])}
                    style={styles.saveBtn}
                    aria-label={`Save system setting ${key}`}
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Export Downloads */}
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Download Executive Reports (CSV)</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => handleExport('students')} style={styles.exportBtn}>
              <FiDownload /> Students
            </button>
            <button onClick={() => handleExport('courses')} style={styles.exportBtn}>
              <FiDownload /> Courses
            </button>
            <button onClick={() => handleExport('system')} style={styles.exportBtn}>
              <FiDownload /> Settings
            </button>
          </div>
        </div>

        {/* Uptime & Monitoring Panel */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}><FiActivity /> Server Diagnostics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={styles.healthItem}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Database Cluster Connection</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCheckCircle /> CONNECTED
                </span>
              </div>
            </div>
            <div style={styles.healthItem}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Redis Caching Ring</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCheckCircle /> ACTIVE
                </span>
              </div>
            </div>
            <div style={styles.healthItem}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Celery Task Queue Worker</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCheckCircle /> RUNNING
                </span>
              </div>
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
    color: 'var(--text-primary)'
  },
  header: {
    marginBottom: '2rem'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2.5rem'
  },
  statCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase'
  },
  statValue: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: 'var(--accent-primary)'
  },
  statFoot: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2.5rem'
  },
  panel: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem'
  },
  panelTitle: {
    fontSize: '1.2rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  searchInput: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '0.4rem 0.6rem 0.4rem 2rem',
    fontSize: '0.85rem',
    outline: 'none',
    width: '200px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.85rem'
  },
  tr: {
    borderBottom: '1px solid var(--border-primary)'
  },
  th: {
    padding: '0.75rem 1rem',
    color: 'var(--text-secondary)',
    fontWeight: 'var(--fw-medium)'
  },
  td: {
    padding: '0.75rem 1rem',
    verticalAlign: 'middle'
  },
  selectSmall: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '0.2rem 0.4rem',
    fontSize: '0.8rem',
    outline: 'none'
  },
  suspendBtn: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    color: 'var(--color-error)',
    border: 'none',
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  activateBtn: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    color: 'var(--color-success)',
    border: 'none',
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  pageBtn: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  settingInput: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '0.35rem 0.6rem',
    fontSize: '0.8rem',
    outline: 'none',
    width: '180px'
  },
  saveBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  healthItem: {
    padding: '1rem',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px'
  }
};
