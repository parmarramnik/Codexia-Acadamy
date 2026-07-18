import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiBook, FiCode, FiFileText, FiLayers,
  FiMessageSquare, FiAward, FiBarChart2, FiTrendingUp,
  FiUser, FiSettings, FiShield, FiEdit3, FiCpu,
} from 'react-icons/fi';
import './Sidebar.css';

const studentLinks = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/my-courses', icon: FiBook, label: 'My Courses' },
  { to: '/coding', icon: FiCode, label: 'Coding Practice' },
  { to: '/notes', icon: FiFileText, label: 'Notes' },
  { to: '/flashcards', icon: FiLayers, label: 'Flashcards' },
  { to: '/ai-workspace', icon: FiCpu, label: 'Enterprise AI' },
  { to: '/discussion', icon: FiMessageSquare, label: 'Collaboration Hub' },
  { to: '/certificates', icon: FiAward, label: 'Certificates' },
  { to: '/analytics', icon: FiBarChart2, label: 'Analytics' },
  { to: '/leaderboard', icon: FiTrendingUp, label: 'Leaderboard' },
];

const instructorLinks = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/instructor', icon: FiEdit3, label: 'Instructor Panel' },
  { to: '/discussion', icon: FiMessageSquare, label: 'Collaboration Hub' },
];

const adminLinks = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/admin', icon: FiShield, label: 'Admin Panel' },
  { to: '/admin-portal', icon: FiShield, label: 'Executive Portal' },
  { to: '/discussion', icon: FiMessageSquare, label: 'Collaboration Hub' },
];

const bottomLinks = [
  { to: '/profile', icon: FiUser, label: 'Profile' },
  { to: '/settings', icon: FiSettings, label: 'Settings' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const isStudent = user?.role === 'student' || !user?.role;
  const isInstructor = user?.role === 'instructor';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  let visibleLinks = studentLinks;
  let sectionLabel = 'Learning';

  if (isAdmin) {
    visibleLinks = adminLinks;
    sectionLabel = 'Administration';
  } else if (isInstructor) {
    visibleLinks = instructorLinks;
    sectionLabel = 'Instructor';
  }

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-brand">Codexia</span>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <span className="sidebar-section-label">
            {sectionLabel}
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
