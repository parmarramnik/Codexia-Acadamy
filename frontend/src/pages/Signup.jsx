import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import api from '../services/api';
import { FaGoogle, FaGithub } from 'react-icons/fa';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthConfig, setOauthConfig] = useState({ google_client_id: '', github_client_id: '' });

  useEffect(() => {
    async function loadOauthConfig() {
      try {
        const res = await api.get('/auth/oauth/config');
        setOauthConfig(res.data);
      } catch (err) {
        console.error('Failed to load OAuth configurations', err);
      }
    }
    loadOauthConfig();
  }, []);

  const handleGoogleLogin = () => {
    if (oauthConfig.google_client_id) {
      const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback/google`);
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthConfig.google_client_id}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`;
    } else {
      toast.success('Bypassing credentials check (Developer Fallback Mode)!');
      navigate('/oauth/callback/google?code=mock_google_code');
    }
  };

  const handleGithubLogin = () => {
    if (oauthConfig.github_client_id) {
      const redirectUri = encodeURIComponent(`${window.location.origin}/oauth/callback/github`);
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${oauthConfig.github_client_id}&redirect_uri=${redirectUri}&scope=user:email`;
    } else {
      toast.success('Bypassing credentials check (Developer Fallback Mode)!');
      navigate('/oauth/callback/github?code=mock_github_code');
    }
  };

  const validatePassword = (pwd) => {
    return pwd.length >= 6;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, username, email, password, confirmPassword, role } = formData;

    if (!fullName || !username || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!validatePassword(password)) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await signup({
        email,
        username,
        full_name: fullName,
        password,
        role,
      });
      toast.success('Account created successfully! Please verify your email and sign in.');
      navigate('/login');
    } catch (err) {
      let errorMsg = 'Registration failed';
      const detail = err.response?.data?.detail;
      if (detail) {
        if (Array.isArray(detail)) {
          errorMsg = detail.map(d => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        }
      }
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Create Account</h2>
          <p style={styles.subtitle}>Join Codexia to personalize your learning journey</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="fullName" style={styles.label}>Full Name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="e.g. John Doe"
              value={formData.fullName}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="username" style={styles.label}>Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="e.g. johndoe"
              value={formData.username}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="e.g. name@domain.com"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="role" style={styles.label}>Register As</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              style={styles.select}
              required
            >
              <option value="student">Student (Learn with AI)</option>
              <option value="instructor">Instructor (Create Courses)</option>
              <option value="admin">Admin (Manage Platform)</option>
              <option value="super_admin">Super Admin (Full System Control)</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
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

          <div style={styles.inputGroup}>
            <label htmlFor="confirmPassword" style={styles.label}>Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="Creating Account..."
            style={styles.submitBtn}
          >
            Sign Up
          </LoadingButton>
        </form>

        <div style={styles.dividerContainer}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or continue with</span>
          <div style={styles.dividerLine} />
        </div>

        <div style={styles.oauthGrid}>
          <button type="button" onClick={handleGoogleLogin} style={styles.oauthBtn}>
            <FaGoogle style={{ marginRight: '8px', color: '#EA4335' }} /> Google
          </button>
          <button type="button" onClick={handleGithubLogin} style={styles.oauthBtn}>
            <FaGithub style={{ marginRight: '8px', color: '#F5F5F5' }} /> GitHub
          </button>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have an account? <Link to="/login" style={styles.link}>Sign In</Link>
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
    minHeight: 'calc(100vh - var(--navbar-height))',
    backgroundColor: 'var(--bg-primary)',
    padding: '2rem 1rem',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem',
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
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
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    transition: 'border-color var(--transition-fast)',
  },
  select: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color var(--transition-fast)',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputPassword: {
    width: '100%',
    padding: '0.75rem 3.5rem 0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    transition: 'border-color var(--transition-fast)',
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
};
