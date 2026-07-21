import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import api from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [showResend, setShowResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    if (!email) {
      toast.error('Please enter your email address first.');
      return;
    }
    setIsResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('Verification link has been resent to your inbox!');
      setShowResend(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resend verification link.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, rememberMe);
      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (err) {
      let errorMsg = 'Invalid email or password';
      const detail = err.response?.data?.detail;
      if (detail) {
        if (Array.isArray(detail)) {
          errorMsg = detail.map(d => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        }
      }
      toast.error(errorMsg);
      if (errorMsg.toLowerCase().includes('not verified')) {
        setShowResend(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Sign In</h2>
          <p style={styles.subtitle}>Welcome back to Codexia Academy</p>
        </div>

        {showResend && (
          <div style={styles.resendContainer}>
            <p style={styles.resendText}>Your email address is not verified.</p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResending}
              style={styles.resendBtn}
            >
              {isResending ? 'Resending...' : 'Resend Verification Email'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="e.g. name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <div style={styles.passwordHeader}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <Link to="/forgot-password" style={styles.forgotLink}>Forgot Password?</Link>
            </div>
            <div style={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.inputPassword}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.showButton}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={styles.checkboxContainer}>
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={styles.checkbox}
            />
            <label htmlFor="remember_me" style={styles.checkboxLabel}>Remember me for 7 days</label>
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="Signing In..."
            style={styles.submitBtn}
          >
            Sign In
          </LoadingButton>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            New to Codexia? <Link to="/signup" style={styles.link}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80vh',
    padding: '2rem 1rem',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-primary)',
    padding: '2.5rem 2rem',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  passwordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-primary)',
  },
  forgotLink: {
    fontSize: '0.75rem',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-medium)',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputPassword: {
    width: '100%',
    padding: '0.75rem 3rem 0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  showButton: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    padding: '0.25rem',
  },
  checkboxContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  checkbox: {
    accentColor: 'var(--accent-primary)',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  btnDisabled: {
    backgroundColor: 'var(--border-primary)',
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: '1rem',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  link: {
    color: 'var(--color-link)',
    fontWeight: 'var(--fw-medium)',
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '1.5rem 0',
    gap: '0.75rem',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--border-primary)',
  },
  dividerText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  oauthGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  oauthBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  resendContainer: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    border: '1px solid rgba(231, 76, 60, 0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  resendText: {
    color: '#e74c3c',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
  },
  resendBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #e74c3c',
    borderRadius: 'var(--radius-md)',
    color: '#e74c3c',
    padding: '0.5rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};
