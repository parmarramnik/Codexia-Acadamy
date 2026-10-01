import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingButton from '../components/common/LoadingButton';
import AuthShell from '../components/common/AuthShell';
import { FiEye, FiEyeOff, FiUserPlus } from 'react-icons/fi';

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
      toast.success('Account created! Please enter the 6-digit OTP code sent to verify your account.');
      navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}`);
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
    <AuthShell
      title="Create your account"
      subtitle="Join Codexia to personalize your learning journey"
      icon={FiUserPlus}
      width={460}
      footer={<>Already have an account? <Link to="/login">Sign In</Link></>}
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fullName" className="form-label">Full name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={handleChange}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="username" className="form-label">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-input"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            className="form-input"
            placeholder="name@domain.com"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="role" className="form-label">Register as</label>
          <select
            id="role"
            name="role"
            className="form-input form-select"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="student">Student (Learn with AI)</option>
            <option value="instructor">Instructor (Create Courses)</option>
            <option value="admin">Admin (Manage Platform)</option>
            <option value="super_admin">Super Admin (Full System Control)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <div className="input-with-icon">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
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
          <span className="form-hint">Use 6 or more characters.</span>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="form-input"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            aria-invalid={formData.confirmPassword && formData.confirmPassword !== formData.password ? 'true' : undefined}
            required
          />
          {formData.confirmPassword && formData.confirmPassword !== formData.password && (
            <span className="form-error">Passwords do not match</span>
          )}
        </div>

        <LoadingButton
          type="submit"
          loading={isLoading}
          loadingText="Creating Account..."
          className="btn btn-primary btn-lg btn-block"
        >
          Sign Up
        </LoadingButton>
      </form>
    </AuthShell>
  );
}
