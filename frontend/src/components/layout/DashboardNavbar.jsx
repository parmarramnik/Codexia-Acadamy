import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { FiBell, FiLogOut, FiSearch, FiSun, FiMoon, FiMenu } from 'react-icons/fi';
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
        badgeBg: 'var(--color-info-bg)',
        badgeColor: 'var(--accent-purple)'
      }));
      (res.data.problems || []).forEach(p => results.push({
        type: 'Problem',
        label: p.title,
        detail: p.difficulty || 'Coding',
        path: `/coding/${p.slug}`,
        badgeBg: 'var(--color-success-bg)',
        badgeColor: 'var(--color-success)'
      }));
      (res.data.quizzes || []).forEach(q => results.push({
        type: 'Quiz',
        label: (q.title || '').replace(/^AI Quiz:\s*/i, ''),
        detail: q.topic || 'Assessment',
        path: '/quizzes',
        badgeBg: 'var(--accent-light)',
        badgeColor: 'var(--accent-primary)'
      }));
      (res.data.notes || []).forEach(n => results.push({
        type: 'Note',
        label: n.title,
        detail: n.course_title || 'Personal Note',
        path: '/notes',
        badgeBg: 'var(--color-warning-bg)',
        badgeColor: 'var(--color-warning)'
      }));
      (res.data.discussions || []).forEach(d => results.push({
        type: 'Community',
        label: d.title,
        detail: d.user_name || 'Discussion',
        path: '/community',
        badgeBg: 'var(--color-info-bg)',
        badgeColor: 'var(--color-info)'
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
            className="dashboard-mobile-toggle"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            title="Toggle sidebar"
          >
            <FiMenu size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '480px' }}>
            <div className="dashboard-search" style={{ position: 'relative', width: '100%' }}>
              <FiSearch
                className="search-icon"
                style={{ color: searchQuery ? 'var(--accent-primary)' : undefined }}
              />
              <input
                type="text"
                className="form-input search-input"
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
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="search-clear-btn"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  &#10005;
                </button>
              )}
              {showDropdown && (
                <div className="search-dropdown">
                  {suggestions.length === 0 ? (
                    <div className="search-dropdown-empty">
                      {isSearching ? 'Searching...' : `No results for "${searchQuery}"`}
                    </div>
                  ) : (
                    <>
                      <div className="search-dropdown-header">
                        <span>Results ({suggestions.length})</span>
                        <span>ESC to close</span>
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
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '10px' }}>
                            <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.detail}</span>
                          </div>
                          <span
                            className="search-badge"
                            style={{
                              backgroundColor: s.badgeBg,
                              color: s.badgeColor,
                            }}
                          >
                            {s.type}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-navbar-actions">
            {/* Theme Toggle */}
            <button
              className="btn-icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? (
                <FiSun size={18} style={{ color: '#FBBF24' }} />
              ) : (
                <FiMoon size={18} style={{ color: 'var(--accent-primary)' }} />
              )}
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                className="btn-icon"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
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
              <FiLogOut size={18} />
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
