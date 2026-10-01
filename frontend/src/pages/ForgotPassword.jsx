import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import AuthShell from '../components/common/AuthShell';
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

  const titles = { 1: 'Reset your password', 2: 'Check your email', 3: 'Password updated' };
  const subtitles = {
    1: 'Enter your email to receive a 6-digit verification code.',
    2: `We sent a 6-digit code to ${email}`,
    3: 'Your password has been securely updated.',
  };

  return (
    <AuthShell
      title={titles[step]}
      subtitle={subtitles[step]}
      icon={step === 3 ? FiCheckCircle : step === 2 ? FiMail : FiLock}
      footer={step < 3 ? <>Back to <Link to="/login">Sign In</Link></> : null}
    >
      {step < 3 && (
        <div className="auth-steps" aria-label={`Step ${step} of 2`}>
          <span className={step >= 1 ? 'active' : ''} />
          <span className={step >= 2 ? 'active' : ''} />
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleRequestOtp} className="form-stack">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <div className="input-with-icon">
              <span className="input-icon"><FiMail size={16} /></span>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="Sending OTP Code..."
            className="btn btn-primary btn-lg btn-block"
          >
            Get Verification Code
          </LoadingButton>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleResetPassword} className="form-stack">
          <div className="form-group">
            <label htmlFor="otp" className="form-label">Verification code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="form-input otp-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword" className="form-label">New password</label>
            <div className="input-with-icon">
              <span className="input-icon"><FiLock size={16} /></span>
              <input
                id="newPassword"
                type="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <LoadingButton
            type="submit"
            loading={isLoading}
            loadingText="Verifying Code..."
            className="btn btn-primary btn-lg btn-block"
          >
            Verify Code & Reset
          </LoadingButton>

          <button type="button" onClick={() => setStep(1)} className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}>
            Change email address
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="form-stack" style={{ textAlign: 'center' }}>
          <div className="alert alert-success" style={{ textAlign: 'left' }}>
            <FiCheckCircle size={16} />
            <span>Your account security has been restored. You can now log in with your new credentials.</span>
          </div>
          <Link to="/login" className="btn btn-primary btn-lg btn-block">Proceed to Login</Link>
        </div>
      )}
    </AuthShell>
  );
}
