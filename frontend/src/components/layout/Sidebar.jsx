import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiBook, FiCode, FiFileText, FiLayers,
  FiMessageSquare, FiAward, FiBarChart2, FiTrendingUp,
  FiUser, FiSettings, FiShield, FiEdit3,
} from 'react-icons/fi';
import './Sidebar.css';

const studentLinks = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/my-courses', icon: FiBook, label: 'My Courses' },
  { to: '/coding', icon: FiCode, label: 'Coding Practice' },
  { to: '/notes', icon: FiFileText, label: 'Notes' },
  { to: '/flashcards', icon: FiLayers, label: 'Flashcards' },
  { to: '/ai-tutor', icon: FiMessageSquare, label: 'AI Tutor' },
  { to: '/certificates', icon: FiAward, label: 'Certificates' },
  { to: '/analytics', icon: FiBarChart2, label: 'Analytics' },
  { to: '/leaderboard', icon: FiTrendingUp, label: 'Leaderboard' },
];

const bottomLinks = [
  { to: '/profile', icon: FiUser, label: 'Profile' },
  { to: '/settings', icon: FiSettings, label: 'Settings' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const showAdminLink = user?.role === 'admin' || user?.role === 'super_admin';
  const showInstructorLink = user?.role === 'instructor' || showAdminLink;
  const isStudent = user?.role === 'student' || !user?.role; // Default fallback to student

  // Filter links: non-students only get Dashboard and Coding Practice from the main section
  const visibleLinks = studentLinks.filter((link) => {
    if (isStudent) return true;
    // For admin/instructor, only show Dashboard and Coding Practice
    return link.to === '/dashboard' || link.to === '/coding';
  });

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-brand">Codexia</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <span className="sidebar-section-label">
            {isStudent ? 'Learning' : 'Workspace'}
          </span>
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <link.icon className="sidebar-icon" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        {showInstructorLink && (
          <div className="sidebar-section">
            <span className="sidebar-section-label">Instructor</span>
            <NavLink to="/instructor" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FiEdit3 className="sidebar-icon" />
              <span>Instructor Panel</span>
            </NavLink>
          </div>
        )}

        {showAdminLink && (
          <div className="sidebar-section">
            <span className="sidebar-section-label">Administration</span>
            <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FiShield className="sidebar-icon" />
              <span>Admin Panel</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-bottom">
        {bottomLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <link.icon className="sidebar-icon" />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
