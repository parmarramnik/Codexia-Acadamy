import { useAuth } from '../../context/AuthContext';
import { FiBell, FiLogOut, FiSearch } from 'react-icons/fi';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './DashboardNavbar.css';

export default function DashboardNavbar() {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearchChange = async (val) => {
    setSearchQuery(val);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await api.get('/search', { params: { q: val } });
      const results = [];
      (res.data.courses || []).forEach(c => results.push({ type: 'Course', label: c.title, path: `/courses/${c.slug}` }));
      (res.data.problems || []).forEach(p => results.push({ type: 'Problem', label: p.title, path: `/coding/${p.slug}` }));
      setSuggestions(results.slice(0, 5));
      setShowDropdown(results.length > 0);
    } catch(e) {}
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="dashboard-navbar" id="dashboard-navbar">
      <div className="dashboard-navbar-inner">
        <div className="dashboard-search" style={{ position: 'relative' }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search courses, notes, problems..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowDropdown(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '45px',
              left: 0,
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
              zIndex: 1000,
              maxHeight: '240px',
              overflowY: 'auto'
            }}>
              {suggestions.map((s, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    navigate(s.path);
                    setSearchQuery('');
                    setSuggestions([]);
                    setShowDropdown(false);
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span>{s.label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{s.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-navbar-actions">
          <button className="btn-icon" aria-label="Notifications">
            <FiBell size={18} />
          </button>

          <div className="user-menu">
            <div className="avatar avatar-sm">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} />
              ) : (
                getInitials(user?.full_name)
              )}
            </div>
            <div className="user-info hide-mobile">
              <span className="user-name">{user?.full_name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>

          <button className="btn-icon" onClick={handleLogout} aria-label="Logout">
            <FiLogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
