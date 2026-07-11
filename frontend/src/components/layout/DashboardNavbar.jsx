import { useAuth } from '../../context/AuthContext';
import { FiBell, FiLogOut, FiSearch } from 'react-icons/fi';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardNavbar.css';

export default function DashboardNavbar() {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="dashboard-navbar" id="dashboard-navbar">
      <div className="dashboard-navbar-inner">
        <div className="dashboard-search">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search courses, notes, problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
