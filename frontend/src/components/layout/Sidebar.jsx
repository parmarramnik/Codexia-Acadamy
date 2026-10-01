import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiBook, FiCode, FiFileText, FiLayers,
  FiMessageSquare, FiAward, FiBarChart2, FiTrendingUp,
  FiShield, FiEdit3, FiCpu, FiCheckSquare,
  FiSidebar
} from 'react-icons/fi';
import './Sidebar.css';

function BrandMark() {
  return (
    <span className="sidebar-brand-mark" aria-hidden="true">
      <FiCode size={16} strokeWidth={2.5} />
    </span>
  );
}

export default function Sidebar({ isCollapsed = false, isMobileOpen = false, onToggleSidebar }) {
  const { user } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isInstructor = user?.role === 'instructor';

  const learningLinks = [
    { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { to: '/courses', icon: FiBook, label: 'Courses' },
    { to: '/quizzes', icon: FiCheckSquare, label: 'Quizzes & Tests' },
  ];

  const toolsLinks = [
    { to: '/coding', icon: FiCode, label: 'Coding Practice' },
    { to: '/ai-workspace', icon: FiCpu, label: 'Study Assistant' },
    { to: '/notes', icon: FiFileText, label: 'Notes & Docs' },
    { to: '/flashcards', icon: FiLayers, label: 'Flashcards' },
  ];

  const communityLinks = [
    { to: '/discussion', icon: FiMessageSquare, label: 'Discussions' },
    { to: '/certificates', icon: FiAward, label: 'Certificates' },
    { to: '/analytics', icon: FiBarChart2, label: 'Analytics' },
    { to: '/leaderboard', icon: FiTrendingUp, label: 'Leaderboard' },
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

  const initials = (user?.full_name || user?.email || '?')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const renderLink = (link) => (
    <NavLink
      key={link.to}
      to={link.to}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
      aria-label={isCollapsed ? link.label : undefined}
    >
      <link.icon className="sidebar-icon" aria-hidden="true" />
      <span className="sidebar-link-label">{link.label}</span>
      {isCollapsed && <span className="sidebar-tooltip" role="tooltip">{link.label}</span>}
    </NavLink>
  );

  const renderSection = (label, links) => (
    <div className="sidebar-section">
      <span className="sidebar-section-label">{label}</span>
      {links.map(renderLink)}
    </div>
  );

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
      id="sidebar"
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        {isCollapsed ? (
          <button
            onClick={onToggleSidebar}
            className="sidebar-brand-collapsed-btn"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <BrandMark />
          </button>
        ) : (
          <>
            <NavLink to="/dashboard" className="sidebar-brand-wrapper" aria-label="Codexia Academy home">
              <BrandMark />
              <span className="sidebar-brand-title">
                Codexia <span className="sidebar-brand-sub">Academy</span>
              </span>
            </NavLink>

            <button
              onClick={onToggleSidebar}
              className="sidebar-header-toggle"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <FiSidebar size={16} />
            </button>
          </>
        )}
      </div>

      <nav className="sidebar-nav">
        {renderSection('Learn', learningLinks)}
        {renderSection('Practice', toolsLinks)}
        {renderSection('Community', communityLinks)}
        {adminLinks.length > 0 && renderSection('Administration', adminLinks)}
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/profile" className="sidebar-user" title={user?.full_name || 'Profile'}>
          <span className="avatar avatar-sm">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" loading="lazy" /> : initials}
          </span>
          <span className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name || 'Your account'}</span>
            <span className="sidebar-user-role">{user?.role?.replace('_', ' ') || 'student'}</span>
          </span>
        </NavLink>
      </div>
    </aside>
  );
}
