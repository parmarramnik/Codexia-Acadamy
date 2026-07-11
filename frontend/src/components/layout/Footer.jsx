import { Link } from 'react-router-dom';
import { FiCode, FiGithub, FiTwitter, FiLinkedin } from 'react-icons/fi';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <FiCode className="brand-icon" />
              <span>Codexia</span>
            </div>
            <p className="footer-desc">
              Master programming with AI-powered courses, coding practice, and personalized tutoring.
            </p>
          </div>

          <div className="footer-section">
            <h4 className="footer-title">Platform</h4>
            <Link to="/courses" className="footer-link">Courses</Link>
            <Link to="/pricing" className="footer-link">Pricing</Link>
            <Link to="/about" className="footer-link">About</Link>
            <Link to="/contact" className="footer-link">Contact</Link>
          </div>

          <div className="footer-section">
            <h4 className="footer-title">Resources</h4>
            <Link to="/faq" className="footer-link">FAQ</Link>
            <Link to="/coding" className="footer-link">Practice</Link>
            <Link to="/leaderboard" className="footer-link">Leaderboard</Link>
          </div>

          <div className="footer-section">
            <h4 className="footer-title">Connect</h4>
            <div className="footer-socials">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="GitHub">
                <FiGithub />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Twitter">
                <FiTwitter />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="LinkedIn">
                <FiLinkedin />
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} Codexia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
