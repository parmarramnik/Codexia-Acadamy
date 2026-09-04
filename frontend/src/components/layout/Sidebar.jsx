import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiBook, FiCode, FiFileText, FiLayers,
  FiMessageSquare, FiAward, FiBarChart2, FiTrendingUp,
  FiUser, FiSettings, FiShield, FiEdit3, FiCpu, FiCheckSquare,
  FiMenu
} from 'react-icons/fi';
import './Sidebar.css';

export default function Sidebar({ isCollapsed = false, isMobileOpen = false, onToggleSidebar }) {
  const { user } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isInstructor = user?.role === 'instructor';

  const learningLinks = [
    { to: '/dashboard', icon: FiHome, label: 'Dashboard', color: '#818CF8' },
    { to: '/courses', icon: FiBook, label: 'Courses', color: '#34D399' },
    { to: '/quizzes', icon: FiCheckSquare, label: 'Quizzes & Tests', color: '#FBBF24' },
  ];

  const toolsLinks = [
    { to: '/coding', icon: FiCode, label: 'Coding Practice', color: '#2DD4BF' },
    { to: '/ai-workspace', icon: FiCpu, label: 'Study Assistant', color: '#A78BFA' },
    { to: '/notes', icon: FiFileText, label: 'Notes & Docs', color: '#F472B6' },
    { to: '/flashcards', icon: FiLayers, label: 'Flashcards', color: '#FB923C' },
  ];

  const communityLinks = [
    { to: '/discussion', icon: FiMessageSquare, label: 'Discussions', color: '#60A5FA' },
    { to: '/certificates', icon: FiAward, label: 'Certificates', color: '#FBBF24' },
    { to: '/analytics', icon: FiBarChart2, label: 'Analytics', color: '#4ADE80' },
    { to: '/leaderboard', icon: FiTrendingUp, label: 'Leaderboard', color: '#F43F5E' },
  ];

  const adminLinks = [];
  if (isSuperAdmin) {
    adminLinks.push({ to: '/admin-portal', icon: FiShield, label: 'Executive Portal' });
    adminLinks.push({ to: '/admin', icon: FiShield, label: 'Admin Panel' });
  } else if (isAdmin) {
    adminLinks.push({ to: '/admin', icon: FiShield, label: 'Admin Panel' });
  }
  if (isInstructor || isAdmin || isSuperAdmin) {
    adminLinks.push({ to: '/instructor', icon: FiEdit3, label: 'Instructor Panel' });
  }

  const accountLinks = [
    { to: '/profile', icon: FiUser, label: 'Profile' },
    { to: '/settings', icon: FiSettings, label: 'Settings' },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`} id="sidebar">
      {/* Upper-Left Sidebar Header: Switches between Three Lines (when open) and Logo (when collapsed) */}
      <div className="sidebar-header">
        {isCollapsed ? (
          <button 
            onClick={onToggleSidebar} 
            className="sidebar-brand-collapsed-btn"
            title="Expand Sidebar (Codexia Academy)"
            aria-label="Expand Sidebar"
          >
            <FiCode size={20} style={{ color: '#818CF8' }} />
          </button>
        ) : (
          <>
            <div className="sidebar-brand-wrapper">
              <span className="sidebar-brand-logo" style={{ display: 'flex', alignItems: 'center' }}>
                <FiCode size={20} style={{ color: '#818CF8' }} />
              </span>
              <span className="sidebar-brand-title">
                Codexia <span style={{ color: 'var(--accent-primary)' }}>Academy</span>
              </span>
            </div>

            <button 
              onClick={onToggleSidebar} 
              className="sidebar-header-toggle"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <FiMenu size={18} />
            </button>
          </>
        )}
      </div>

      <nav className="sidebar-nav">
        {/* Category 1: Learning Hub */}
        <div className="sidebar-section">
          {!isCollapsed && <span className="sidebar-section-label">Learning Hub</span>}
          {learningLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <link.icon className="sidebar-icon" style={{ color: link.color }} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Category 2: Practice & Tools */}
        <div className="sidebar-section">
          {!isCollapsed && <span className="sidebar-section-label">Practice & Tools</span>}
          {toolsLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <link.icon className="sidebar-icon" style={{ color: link.color }} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Category 3: Community & Reports */}
        <div className="sidebar-section">
          {!isCollapsed && <span className="sidebar-section-label">Community & Reports</span>}
          {communityLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <link.icon className="sidebar-icon" style={{ color: link.color }} />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Category 4: Administration (Role Based) */}
        {adminLinks.length > 0 && (
          <div className="sidebar-section">
            {!isCollapsed && <span className="sidebar-section-label">Administration</span>}
            {adminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <link.icon className="sidebar-icon" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Category 5: Account Footer */}
      <div className="sidebar-bottom">
        {!isCollapsed && <span className="sidebar-section-label" style={{ paddingLeft: 'var(--space-6)', marginBottom: '4px' }}>Account</span>}
        {accountLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <link.icon className="sidebar-icon" />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
