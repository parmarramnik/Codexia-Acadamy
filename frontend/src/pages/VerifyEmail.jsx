import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function verify() {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token. Please use a valid verification link.');
        return;
      }
      try {
        const res = await api.get(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage(res.data.message || 'Email verified successfully! You can now log in.');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification failed. The token may be invalid or expired.');
      }
    }
    verify();
  }, [token]);

  return (
    <div style={styles.container}>
      <div style={styles.glassCard}>
        {status === 'loading' && (
          <div style={styles.content}>
            <FiLoader size={48} style={styles.loadingSpinner} />
            <h2 style={styles.title}>Verifying Your Email</h2>
            <p style={styles.desc}>Please wait while we secure your account registration...</p>
          </div>
        )}

        {status === 'success' && (
          <div style={styles.content}>
            <FiCheckCircle size={48} style={styles.successIcon} />
            <h2 style={styles.title}>Account Verified!</h2>
            <p style={styles.desc}>{message}</p>
            <Link to="/login" style={styles.actionBtn}>Proceed to Login</Link>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.content}>
            <FiXCircle size={48} style={styles.errorIcon} />
            <h2 style={styles.title}>Verification Failed</h2>
            <p style={styles.desc}>{message}</p>
            <Link to="/signup" style={styles.secondaryBtn}>Back to Signup</Link>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'radial-gradient(circle at top right, rgba(255, 152, 0, 0.15), transparent 60%), radial-gradient(circle at bottom left, rgba(25, 25, 25, 1), rgba(15, 15, 15, 1))',
    padding: '1.5rem',
  },
  glassCard: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'rgba(30, 30, 30, 0.65)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '3rem 2rem',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    textAlign: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
  },
  loadingSpinner: {
    color: 'var(--accent-primary)',
    animation: 'spin 1.5s linear infinite',
  },
  successIcon: {
    color: '#10B981',
  },
  errorIcon: {
    color: '#EF4444',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.025em',
  },
  desc: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: '1rem',
  },
  actionBtn: {
    width: '100%',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    padding: '0.85rem',
    borderRadius: '8px',
    fontWeight: '600',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(255, 152, 0, 0.3)',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    padding: '0.85rem',
    borderRadius: '8px',
    fontWeight: '600',
    textDecoration: 'none',
    border: '1px solid var(--border-primary)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
};
