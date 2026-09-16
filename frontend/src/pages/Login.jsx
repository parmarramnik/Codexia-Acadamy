import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import { FiEye, FiEyeOff, FiCode } from 'react-icons/fi';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    const logoutReason = sessionStorage.getItem('logout_reason');
    if (logoutReason) {
      toast.error(logoutReason, { duration: 6000 });
      sessionStorage.removeItem('logout_reason');
    }
  }, []);

  const handleResendVerification = () => {
    if (!email) {
      toast.error('Please enter your email address first.');
      return;
    }
    navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
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
        setTimeout(() => {
          navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        }, 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        padding: '2rem 1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-primary)',
          padding: 'clamp(1.75rem, 3vw, 2.5rem) clamp(1.5rem, 3vw, 2rem)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: 'var(--accent-primary)',
            }}
          >
            <FiCode size={24} />
          </div>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text-primary)',
              marginBottom: '0.4rem',
            }}
          >
            Sign In
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Welcome back to Codexia Academy
          </p>
        </div>

        {/* Resend verification notice */}
        {showResend && (
          <div
            style={{
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
            role="alert"
          >
            <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              Your account is not verified yet.
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--color-error)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-error)',
                padding: '0.4rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 'var(--fw-medium)',
                cursor: 'pointer',
              }}
            >
              Enter 6-Digit OTP Code
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label htmlFor="email" className="form-label" style={{ color: 'var(--text-primary)' }}>
              Email Address or Username
            </label>
            <input
              id="email"
              type="text"
              className="form-input"
              placeholder="e.g. name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password" className="form-label" style={{ color: 'var(--text-primary)' }}>
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--accent-primary)',
                  fontWeight: 'var(--fw-medium)',
                }}
              >
                Forgot Password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="remember_me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label
              htmlFor="remember_me"
              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Remember me for 7 days
            </label>
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="Signing In..."
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '44px',
              fontSize: '0.9rem',
              marginTop: '0.25rem',
            }}
          >
            Sign In
          </LoadingButton>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            New to Codexia?{' '}
            <Link to="/signup" style={{ color: 'var(--color-link)', fontWeight: 'var(--fw-medium)' }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
