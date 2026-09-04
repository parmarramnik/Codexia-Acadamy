import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { FiBell, FiLogOut, FiSearch, FiSun, FiMoon } from 'react-icons/fi';
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
  
  // Modals & Drawers state
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
        badgeBg: '#2D1B3E',
        badgeColor: '#C084FC'
      }));
      (res.data.problems || []).forEach(p => results.push({
        type: 'Problem',
        label: p.title,
        detail: p.difficulty || 'Coding',
        path: `/coding/${p.slug}`,
        badgeBg: '#142E25',
        badgeColor: '#34D399'
      }));
      (res.data.quizzes || []).forEach(q => results.push({
        type: 'Quiz',
        label: (q.title || '').replace(/^AI Quiz:\s*/i, ''),
        detail: q.topic || 'Assessment',
        path: '/quizzes',
        badgeBg: '#232942',
        badgeColor: '#818CF8'
      }));
      (res.data.notes || []).forEach(n => results.push({
        type: 'Note',
        label: n.title,
        detail: n.course_title || 'Personal Note',
        path: '/notes',
        badgeBg: '#362B16',
        badgeColor: '#FBBF24'
      }));
      (res.data.discussions || []).forEach(d => results.push({
        type: 'Community',
        label: d.title,
        detail: d.user_name || 'Discussion',
        path: '/community',
        badgeBg: '#132E3A',
        badgeColor: '#22D3EE'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '480px' }}>
            <div className="dashboard-search" style={{ position: 'relative', width: '100%' }}>
              <FiSearch className="search-icon" style={{ color: searchQuery ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Search across courses, problems, quizzes, notes..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0 || searchQuery.length >= 2) setShowDropdown(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowDropdown(false);
                  }
                }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: 1,
                    padding: '4px'
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '46px',
                  left: 0,
                  width: '100%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 16px 36px #070B14',
                  zIndex: 1000,
                  maxHeight: '340px',
                  overflowY: 'auto'
                }}>
                  {suggestions.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {isSearching ? 'Searching across platform...' : `No matching items found for "${searchQuery}"`}
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-primary)',
                        background: '#181F2E',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>Spotlight Results ({suggestions.length})</span>
                        <span>Press ESC to close</span>
                      </div>
                      {suggestions.map((s, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            navigate(s.path);
                            clearSearch();
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-primary)' : 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            color: 'var(--text-primary)',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1E2638'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '10px' }}>
                            <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.detail}</span>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: s.badgeBg,
                            color: s.badgeColor,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em'
                          }}>
                            {s.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>


          <div className="dashboard-navbar-actions">
            {/* Theme Toggle Button (Light/Dark Mode) */}
            <button
              className="btn-icon"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? (
                <FiSun size={18} style={{ color: '#38BDF8' }} />
              ) : (
                <FiMoon size={18} style={{ color: '#818CF8' }} />
              )}
            </button>

            {/* Real-Time Interactive Notification Button & Drawer */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                className="btn-icon" 
                onClick={() => setShowNotifications(!showNotifications)} 
                aria-label="Notifications"
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <FiBell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#6366F1',
                    boxShadow: '0 0 8px #6366F1',
                  }} />
                )}
              </button>

              <NotificationDrawer 
                isOpen={showNotifications} 
                onClose={() => setShowNotifications(false)} 
              />
            </div>

            {/* User Profile Summary */}
            <div 
              className="user-menu" 
              onClick={() => navigate('/profile')} 
              style={{ cursor: 'pointer' }}
              title="View Profile"
            >
              <div className="avatar avatar-sm" style={{ border: '1px solid var(--border-light)' }}>
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} loading="lazy" />
                ) : (
                  getInitials(user?.full_name)
                )}
              </div>
              <div className="user-info hide-mobile">
                <span className="user-name">{user?.full_name}</span>
                <span className="user-role">{user?.role}</span>
              </div>
            </div>

            {/* Logout Button with Confirmation Popup */}
            <button 
              className="btn-icon" 
              onClick={() => setShowLogoutModal(true)} 
              aria-label="Logout"
              title="Sign Out"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
}
