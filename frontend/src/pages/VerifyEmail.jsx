import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiCheckCircle, FiShield, FiRotateCw, FiArrowLeft } from 'react-icons/fi';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();

  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const inputRefs = [
    useRef(null), useRef(null), useRef(null),
    useRef(null), useRef(null), useRef(null)
  ];

  // 60-Second Real-Time Countdown Timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle Digit Typing
  const handleDigitChange = (index, value) => {
    // Only accept numeric digits
    const cleaned = value.replace(/[^0-9]/g, '');
    if (!cleaned) {
      const updated = [...otp];
      updated[index] = '';
      setOtp(updated);
      return;
    }

    const digit = cleaned[cleaned.length - 1];
    const updated = [...otp];
    updated[index] = digit;
    setOtp(updated);

    // Auto-focus next input box
    if (index < 5 && digit) {
      inputRefs[index + 1].current?.focus();
    }
  };

  // Handle Backspace & Arrow Keys
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  // Handle 6-Digit Code Paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '');
    if (!pastedData) return;

    const digits = pastedData.slice(0, 6).split('');
    const updated = [...otp];
    digits.forEach((d, idx) => {
      updated[idx] = d;
    });
    setOtp(updated);

    const nextFocusIndex = Math.min(digits.length, 5);
    inputRefs[nextFocusIndex].current?.focus();
  };

  // Resend 6-Digit OTP (Resets 60s timer)
  const handleResendOTP = async () => {
    if (!email) {
      toast.error('Please enter your registered email address.');
      return;
    }
    if (countdown > 0) {
      toast.error(`Please wait ${countdown}s before requesting a new OTP.`);
      return;
    }

    setIsResending(true);
    try {
      await api.post('/auth/resend-otp', { email });
      toast.success('New 6-digit OTP code sent! (Valid for 60 seconds)');
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  // Submit OTP Verification
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const fullCode = otp.join('');

    if (!email) {
      toast.error('Please enter your email address.');
      return;
    }
    if (fullCode.length !== 6) {
      toast.error('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: fullCode });
      const { access_token, refresh_token, user } = res.data;

      setIsSuccess(true);
      toast.success('Email verified successfully! Logging you in...');

      if (access_token && refresh_token && user) {
        loginWithTokens(access_token, refresh_token, user);
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      } else {
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid or expired OTP code.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-submit when all 6 digits are typed
  useEffect(() => {
    if (otp.join('').length === 6 && email) {
      handleVerify();
    }
  }, [otp]);

  return (
    <div style={styles.container}>
      <div style={styles.glassCard}>
        {isSuccess ? (
          <div style={styles.successState}>
            <FiCheckCircle size={64} style={styles.successIcon} />
            <h2 style={styles.title}>Account Verified!</h2>
            <p style={styles.desc}>
              Your account is active. Redirecting you to your learning workspace...
            </p>
          </div>
        ) : (
          <div style={styles.formContainer}>
            <div style={styles.header}>
              <div style={styles.badge}>
                <FiShield size={24} style={styles.badgeIcon} />
              </div>
              <h2 style={styles.title}>Verify Your Email</h2>
              <p style={styles.desc}>
                We sent a 6-digit OTP verification code to{' '}
                <strong style={styles.emailHighlight}>{email || 'your email'}</strong>.
              </p>
            </div>

            {!initialEmail && (
              <div style={styles.inputWrapper}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  style={styles.emailInput}
                />
              </div>
            )}

            <form onSubmit={handleVerify} style={styles.otpForm}>
              <label style={styles.label}>Enter 6-Digit Security Code</label>
              <div style={styles.digitsContainer} onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={inputRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    style={{
                      ...styles.digitInput,
                      borderColor: digit ? 'var(--accent-primary, #FF9800)' : 'rgba(255, 255, 255, 0.12)',
                      backgroundColor: digit ? 'rgba(255, 152, 0, 0.08)' : 'rgba(20, 20, 20, 0.6)',
                    }}
                  />
                ))}
              </div>

              {/* 60-Second Real-Time Countdown & Resend Section */}
              <div style={styles.timerRow}>
                <span style={styles.timerText}>
                  Code expires in:{' '}
                  <strong style={{ color: countdown <= 10 ? '#EF4444' : '#FF9800' }}>
                    00:{countdown < 10 ? `0${countdown}` : countdown}
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={countdown > 0 || isResending}
                  style={{
                    ...styles.resendBtn,
                    opacity: countdown > 0 || isResending ? 0.45 : 1,
                    cursor: countdown > 0 || isResending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <FiRotateCw size={14} style={{ animation: isResending ? 'spin 1s linear infinite' : 'none' }} />
                  {isResending ? 'Sending...' : 'Resend OTP'}
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifying || otp.join('').length !== 6}
                style={{
                  ...styles.submitBtn,
                  opacity: isVerifying || otp.join('').length !== 6 ? 0.6 : 1,
                  cursor: isVerifying || otp.join('').length !== 6 ? 'not-allowed' : 'pointer',
                }}
              >
                {isVerifying ? 'Verifying Code...' : 'Verify & Continue'}
              </button>
            </form>

            <div style={styles.footer}>
              <Link to="/login" style={styles.backLink}>
                <FiArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
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
    backgroundColor: 'rgba(28, 28, 30, 0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '2.5rem 2rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  badge: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'rgba(255, 152, 0, 0.12)',
    border: '1px solid rgba(255, 152, 0, 0.25)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#FF9800',
  },
  badgeIcon: {
    color: '#FF9800',
  },
  title: {
    fontSize: '1.65rem',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  desc: {
    fontSize: '0.92rem',
    color: '#A1A1AA',
    lineHeight: '1.5',
    margin: 0,
  },
  emailHighlight: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#D4D4D8',
    letterSpacing: '0.02em',
  },
  emailInput: {
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(18, 18, 20, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#FFFFFF',
    fontSize: '0.95rem',
    outline: 'none',
  },
  otpForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  digitsContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  digitInput: {
    width: '48px',
    height: '56px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#FFFFFF',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  timerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: '#A1A1AA',
    padding: '0 0.25rem',
  },
  timerText: {
    fontSize: '0.85rem',
  },
  resendBtn: {
    background: 'none',
    border: 'none',
    color: '#FF9800',
    fontWeight: '600',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    transition: 'all 0.2s ease',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#FF9800',
    color: '#FFFFFF',
    padding: '0.85rem',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '1rem',
    border: 'none',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(255, 152, 0, 0.3)',
    marginTop: '0.5rem',
  },
  footer: {
    textAlign: 'center',
    paddingTop: '0.5rem',
  },
  backLink: {
    color: '#A1A1AA',
    fontSize: '0.9rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontWeight: '500',
    transition: 'color 0.2s ease',
  },
  successState: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.5rem 0',
  },
  successIcon: {
    color: '#10B981',
  },
};
