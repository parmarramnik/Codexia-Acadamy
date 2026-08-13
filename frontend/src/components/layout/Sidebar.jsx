import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiBook, FiCode, FiFileText, FiLayers,
  FiMessageSquare, FiAward, FiBarChart2, FiTrendingUp,
  FiUser, FiSettings, FiShield, FiEdit3, FiCpu, FiCalendar, FiCheckSquare,
  FiMenu
} from 'react-icons/fi';
import './Sidebar.css';

export default function Sidebar({ isCollapsed = false, isMobileOpen = false, onToggleSidebar }) {
  const { user } = useAuth();

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isInstructor = user?.role === 'instructor';

  const learningLinks = [
    { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { to: '/my-courses', icon: FiBook, label: 'My Courses' },
    { to: '/quizzes', icon: FiCheckSquare, label: 'Quizzes & Tests' },
    { to: '/planner', icon: FiCalendar, label: 'Study Planner' },
  ];

  const toolsLinks = [
    { to: '/coding', icon: FiCode, label: 'Coding Practice' },
    { to: '/ai-workspace', icon: FiCpu, label: 'Enterprise AI' },
    { to: '/notes', icon: FiFileText, label: 'Notes & Docs' },
    { to: '/flashcards', icon: FiLayers, label: 'Flashcards' },
  ];

  const communityLinks = [
    { to: '/discussion', icon: FiMessageSquare, label: 'Collaboration Hub' },
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

  const accountLinks = [
    { to: '/profile', icon: FiUser, label: 'Profile' },
    { to: '/settings', icon: FiSettings, label: 'Settings' },
  ];

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`} id="sidebar">
      {/* Upper-Left Sidebar Header with 3-Line Hamburger Button */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper">
          <span className="sidebar-brand-logo">⚡</span>
          {!isCollapsed && <span className="sidebar-brand-title">Codexia</span>}
        </div>

        <button 
          onClick={onToggleSidebar} 
          className="sidebar-header-toggle"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label="Toggle Sidebar"
        >
          <FiMenu size={18} />
        </button>
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
              <link.icon className="sidebar-icon" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Category 2: Labs & AI Tools */}
        <div className="sidebar-section">
          {!isCollapsed && <span className="sidebar-section-label">Labs & AI Tools</span>}
          {toolsLinks.map((link) => (
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

        {/* Category 3: Community & Reports */}
        <div className="sidebar-section">
          {!isCollapsed && <span className="sidebar-section-label">Community & Reports</span>}
          {communityLinks.map((link) => (
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
