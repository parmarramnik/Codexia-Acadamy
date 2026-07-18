import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiLoader, FiXCircle, FiAward } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

export default function OauthCallback() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  
  const [status, setStatus] = useState('authenticating'); // 'authenticating' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  // Determine provider based on path
  const provider = window.location.pathname.includes('github') ? 'github' : 'google';

  useEffect(() => {
    async function exchangeCode() {
      if (!code) {
        setStatus('error');
        setErrorMessage('Authorization code is missing from OAuth redirect.');
        return;
      }

      try {
        const endpoint = `/auth/oauth/${provider}`;
        const res = await api.post(endpoint, { code });
        
        // Log user in using context
        const success = loginWithTokens(res.data.access_token, res.data.refresh_token, res.data.user);
        if (success) {
          toast.success(`Successfully signed in via ${provider === 'google' ? 'Google' : 'GitHub'}!`);
          navigate('/dashboard');
        } else {
          setStatus('error');
          setErrorMessage('Failed to configure user session context.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err.response?.data?.detail || 
          `Failed to authenticate with Codexia backend using ${provider === 'google' ? 'Google' : 'GitHub'} credentials.`
        );
      }
    }
    exchangeCode();
  }, [code, provider, navigate, loginWithTokens]);

  return (
    <div style={styles.container}>
      <div style={styles.glassCard}>
        {status === 'authenticating' && (
          <div style={styles.content}>
            <FiLoader size={48} style={styles.loadingSpinner} />
            <h2 style={styles.title}>Securing Social Session</h2>
            <p style={styles.desc}>Verifying OAuth handshake credentials with {provider === 'google' ? 'Google' : 'GitHub'} APIs...</p>
          </div>
        )}

        {status === 'error' && (
          <div style={styles.content}>
            <FiXCircle size={48} style={styles.errorIcon} />
            <h2 style={styles.title}>OAuth Authentication Failed</h2>
            <p style={styles.desc}>{errorMessage}</p>
            
            {/* Helpful Developer Hint */}
            <div style={styles.hintCard}>
              <FiAward style={styles.hintIcon} />
              <div style={styles.hintText}>
                <strong>Developer Notice:</strong> Make sure you have configured <code>GOOGLE_CLIENT_ID</code> or <code>GITHUB_CLIENT_ID</code> and corresponding secrets in your backend <code>.env</code> file.
              </div>
            </div>

            <button onClick={() => navigate('/login')} style={styles.actionBtn}>Back to Login</button>
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
    maxWidth: '460px',
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
  errorIcon: {
    color: '#EF4444',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.025em',
  },
  desc: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: '0.5rem',
  },
  hintCard: {
    display: 'flex',
    gap: '0.75rem',
    backgroundColor: 'rgba(255, 152, 0, 0.08)',
    border: '1px solid rgba(255, 152, 0, 0.2)',
    borderRadius: '8px',
    padding: '0.85rem',
    textAlign: 'left',
    marginTop: '0.5rem',
    marginBottom: '1rem',
  },
  hintIcon: {
    color: 'var(--accent-primary)',
    flexShrink: 0,
    marginTop: '0.15rem',
  },
  hintText: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  actionBtn: {
    width: '100%',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    padding: '0.85rem',
    borderRadius: '8px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(255, 152, 0, 0.3)',
  },
};
