import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FiCode, FiMenu, FiX, FiSun, FiMoon } from 'react-icons/fi';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <FiCode className="brand-icon" />
          <span className="brand-text">Codexia</span>
        </Link>

        <button
          className="navbar-toggle btn-icon"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/courses" className="nav-link">Courses</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/pricing" className="nav-link">Pricing</Link>
          <Link to="/faq" className="nav-link">FAQ</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </div>

        <div className={`navbar-actions ${menuOpen ? 'open' : ''}`}>
          {/* Theme Toggle */}
          <button
            className="btn-icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            style={{ marginRight: '8px', cursor: 'pointer' }}
          >
            {theme === 'dark' ? (
              <FiSun size={18} style={{ color: '#38BDF8' }} />
            ) : (
              <FiMoon size={18} style={{ color: '#818CF8' }} />
            )}
          </button>

          {isAuthenticated ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </button>
          ) : (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/login')}
              >
                Log In
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
