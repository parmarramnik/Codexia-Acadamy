import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiCheckCircle, FiShield, FiRotateCw, FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';
import AuthShell from '../components/common/AuthShell';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@codexia.com';
const INSTRUCTOR_EMAIL = import.meta.env.VITE_INSTRUCTOR_EMAIL || 'instructor@codexia.com';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();

  const initialEmail = searchParams.get('email') || '';
  const initialRole = searchParams.get('role') || 'student';
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

  // Determine if this is a role-approval flow (OTP sent to admin/instructor, not user)
  const cleanEmail = email.trim().toLowerCase();
  const cleanRole = initialRole.trim().toLowerCase();
  const isRoleApproval =
    (cleanRole === 'admin' || cleanRole === 'super_admin' || cleanRole === 'instructor') &&
    cleanEmail !== ADMIN_EMAIL.toLowerCase() &&
    cleanEmail !== INSTRUCTOR_EMAIL.toLowerCase();

  const approvalTarget =
    (cleanRole === 'admin' || cleanRole === 'super_admin') ? ADMIN_EMAIL :
    cleanRole === 'instructor' ? INSTRUCTOR_EMAIL : null;

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

  if (isSuccess) {
    return (
      <AuthShell standalone title="Account verified" subtitle="Your account is active. Redirecting you to your learning workspace..." icon={FiCheckCircle}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" aria-label="Redirecting" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      standalone
      width={460}
      title="Verify your email"
      icon={FiShield}
      subtitle={!isRoleApproval ? (
        <>We sent a 6-digit OTP verification code to <strong style={{ color: 'var(--text)' }}>{email || 'your email'}</strong>.</>
      ) : null}
      footer={
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-2)' }}>
          <FiArrowLeft size={15} /> Back to Sign In
        </Link>
      }
    >
      <div className="form-stack">
        {isRoleApproval && (
          <div className="alert alert-warning">
            <FiAlertTriangle size={16} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>
                {cleanRole.toUpperCase()} access requires approval
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
                The 6-digit OTP has been sent to the official{' '}
                <strong style={{ color: 'var(--text)' }}>{cleanRole === 'instructor' ? 'Instructor' : 'Admin'}</strong>{' '}
                email (<strong style={{ color: 'var(--text)' }}>{approvalTarget}</strong>).
                Please contact them to get your verification code.
              </p>
            </div>
          </div>
        )}

        {!initialEmail && (
          <div className="form-group">
            <label htmlFor="verify-email" className="form-label">Email address</label>
            <input
              id="verify-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
            />
          </div>
        )}

        <form onSubmit={handleVerify} className="form-stack">
          <div className="form-group">
            <span className="form-label" id="otp-label">6-digit security code</span>
            <div className="otp-digits" onPaste={handlePaste} role="group" aria-labelledby="otp-label">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  aria-label={`Digit ${index + 1}`}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`form-input otp-digit ${digit ? 'filled' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="otp-timer-row">
            <span>
              Code expires in{' '}
              <strong className="tabular" style={{ color: countdown <= 10 ? 'var(--danger)' : 'var(--text)' }}>
                00:{countdown < 10 ? `0${countdown}` : countdown}
              </strong>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleResendOTP}
              disabled={countdown > 0 || isResending}
            >
              <FiRotateCw size={13} style={{ animation: isResending ? 'spin 1s linear infinite' : 'none' }} />
              {isResending ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>

          <LoadingButton
            type="submit"
            loading={isVerifying}
            loadingText="Verifying Code..."
            disabled={otp.join('').length !== 6}
            className="btn btn-primary btn-lg btn-block"
          >
            Verify & Continue
          </LoadingButton>
        </form>
      </div>
    </AuthShell>
  );
}
