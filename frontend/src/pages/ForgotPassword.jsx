import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import { FiMail, FiLock, FiCheckCircle } from 'react-icons/fi';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = Request OTP, 2 = Verify OTP & Reset, 3 = Success

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('If registered, a 6-digit OTP code has been sent to your email.');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        otp,
        new_password: newPassword,
      });
      toast.success('Password reset successfully!');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification code is invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {step === 1 && 'Reset Password'}
            {step === 2 && 'Verify Code'}
            {step === 3 && 'Success!'}
          </h2>
          <p style={styles.subtitle}>
            {step === 1 && 'Enter your email to receive a 6-digit verification code.'}
            {step === 2 && `We sent a 6-digit code to ${email}`}
            {step === 3 && 'Your password has been securely updated.'}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleRequestOtp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="email" style={styles.label}>Email Address</label>
              <div style={styles.inputWrapper}>
                <FiMail style={styles.inputIcon} />
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
            </div>

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingText="Sending OTP Code..."
              style={styles.submitBtn}
            >
              Get Verification Code
            </LoadingButton>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="otp" style={styles.label}>Verification Code (OTP)</label>
              <input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={styles.otpInput}
                required
              />
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="newPassword" style={styles.label}>New Password</label>
              <div style={styles.inputWrapper}>
                <FiLock style={styles.inputIcon} />
                <input
                  id="newPassword"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <LoadingButton
              type="submit"
              loading={isLoading}
              loadingText="Verifying Code..."
              style={styles.submitBtn}
            >
              Verify Code & Reset
            </LoadingButton>

            <button
              type="button"
              onClick={() => setStep(1)}
              style={styles.changeEmailBtn}
            >
              Change Email Address
            </button>
          </form>
        )}

        {step === 3 && (
          <div style={styles.successContainer}>
            <FiCheckCircle size={48} style={styles.successIcon} />
            <p style={styles.successText}>
              Your account security has been restored. You can now log in with your new credentials.
            </p>
            <Link to="/login" style={styles.actionBtn}>Proceed to Login</Link>
          </div>
        )}

        {step < 3 && (
          <div style={styles.footer}>
            <p style={styles.footerText}>
              Back to <Link to="/login" style={styles.link}>Sign In</Link>
            </p>
          </div>
        )}
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
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
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
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-primary)',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '1rem',
    color: 'var(--text-secondary)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  otpInput: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '1.25rem',
    letterSpacing: '0.25em',
    textAlign: 'center',
    fontWeight: 'var(--fw-bold)',
    outline: 'none',
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
  changeEmailBtn: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    cursor: 'pointer',
    textAlign: 'center',
    padding: '0.25rem',
    textDecoration: 'underline',
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    textAlign: 'center',
  },
  successIcon: {
    color: '#10B981',
  },
  successText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  actionBtn: {
    width: '100%',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-semibold)',
    textDecoration: 'none',
    textAlign: 'center',
    boxShadow: '0 4px 14px rgba(255, 152, 0, 0.3)',
  },
  footer: {
    marginTop: '1.5rem',
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
};
