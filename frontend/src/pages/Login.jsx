import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import { FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import AuthShell from '../components/common/AuthShell';

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
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Codexia Academy"
      footer={<>New to Codexia? <Link to="/signup">Create an account</Link></>}
    >
      {/* Resend verification notice */}
      {showResend && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1.5rem', flexDirection: 'column', gap: '0.6rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiAlertCircle size={16} /> Your account is not verified yet.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleResendVerification}>
            Enter 6-Digit OTP Code
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-group">
          <label htmlFor="email" className="form-label">Email address or username</label>
          <input
            id="email"
            type="text"
            className="form-input"
            placeholder="name@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <label htmlFor="password" className="form-label">Password</label>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <div className="input-with-icon">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        <label htmlFor="remember_me" className="checkbox-row">
          <input
            id="remember_me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me for 7 days
        </label>

        <LoadingButton
          type="submit"
          loading={isLoading}
          loadingText="Signing In..."
          className="btn btn-primary btn-lg btn-block"
        >
          Sign In
        </LoadingButton>
      </form>
    </AuthShell>
  );
}
