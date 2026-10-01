import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { FiBell, FiLogOut, FiSearch, FiSun, FiMoon, FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import NotificationDrawer from '../common/NotificationDrawer';
import LogoutModal from '../common/LogoutModal';
import './DashboardNavbar.css';

export default function DashboardNavbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigate = useNavigate();

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleSearchChange = async (val) => {
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get('/search/global', { params: { q: val } });
      const results = [];
      (res.data.courses || []).forEach(c => results.push({
        type: 'Course',
        label: c.title,
        detail: c.category?.replace('_', ' ') || 'Course',
        path: `/courses/${c.slug}`,
        badge: 'primary'
      }));
      (res.data.problems || []).forEach(p => results.push({
        type: 'Problem',
        label: p.title,
        detail: p.difficulty || 'Coding',
        path: `/coding/${p.slug}`,
        badge: 'success'
      }));
      (res.data.quizzes || []).forEach(q => results.push({
        type: 'Quiz',
        label: (q.title || '').replace(/^AI Quiz:\s*/i, ''),
        detail: q.topic || 'Assessment',
        path: '/quizzes',
        badge: 'info'
      }));
      (res.data.notes || []).forEach(n => results.push({
        type: 'Note',
        label: n.title,
        detail: n.course_title || 'Personal Note',
        path: '/notes',
        badge: 'warning'
      }));
      (res.data.discussions || []).forEach(d => results.push({
        type: 'Community',
        label: d.title,
        detail: d.user_name || 'Discussion',
        path: '/community',
        badge: 'neutral'
      }));
      setSuggestions(results);
      setShowDropdown(true);
    } catch (e) {
      // Graceful fallback
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <header className="dashboard-navbar" id="dashboard-navbar">
        <div className="dashboard-navbar-inner">
          {/* Mobile hamburger button */}
          <button
            className="dashboard-mobile-toggle btn-icon"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            title="Toggle sidebar"
          >
            <FiMenu size={20} />
          </button>

          <div className="dashboard-search">
            <FiSearch className={`search-icon ${searchQuery ? 'active' : ''}`} aria-hidden="true" />
            <input
              type="text"
              className="search-input"
              placeholder="Search courses, problems, quizzes..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0 || searchQuery.length >= 2) setShowDropdown(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowDropdown(false);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
              aria-label="Global search"
              role="searchbox"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={clearSearch}
                className="search-clear-btn"
                title="Clear search"
                aria-label="Clear search"
              >
                <FiX size={14} />
              </button>
            ) : null}
            {showDropdown && (
              <div className="search-dropdown popover" role="listbox" aria-label="Search results">
                {suggestions.length === 0 ? (
                  <div className="search-dropdown-empty">
                    {isSearching ? (
                      <><span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" /> Searching…</>
                    ) : (
                      <>No results for “{searchQuery}”</>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="search-dropdown-header">
                      <span>{suggestions.length} result{suggestions.length === 1 ? '' : 's'}</span>
                      <span><kbd className="kbd">Esc</kbd> to close</span>
                    </div>
                    {suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="search-dropdown-item"
                        onClick={() => {
                          navigate(s.path);
                          clearSearch();
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        role="option"
                        aria-selected="false"
                      >
                        <div className="search-item-text">
                          <span className="search-item-label">{s.label}</span>
                          <span className="search-item-detail">{s.detail}</span>
                        </div>
                        <span className={`badge badge-${s.badge}`}>{s.type}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="dashboard-navbar-actions">
            {/* Theme Toggle */}
            <button
              className="btn-icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            {/* Notifications */}
            <div className="navbar-notif-wrap">
              <button
                className="btn-icon"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={showNotifications}
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <FiBell size={18} />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>

              <NotificationDrawer
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>

            <span className="navbar-divider" aria-hidden="true" />

            {/* User Profile */}
            <div
              className="user-menu"
              onClick={() => navigate('/profile')}
              title="View Profile"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/profile'); }}
            >
              <div className="avatar avatar-sm">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} loading="lazy" />
                ) : (
                  getInitials(user?.full_name)
                )}
              </div>
              <div className="user-info hide-mobile">
                <span className="user-name">{user?.full_name}</span>
                <span className="user-role">{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Logout */}
            <button
              className="btn-icon"
              onClick={() => setShowLogoutModal(true)}
              aria-label="Logout"
              title="Sign Out"
            >
              <FiLogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
}
