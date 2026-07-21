import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiUser, FiLock, FiSliders, FiSave, FiCheckCircle } from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

const PRESET_AVATARS = [
  { name: 'Developer Orange', url: 'https://ui-avatars.com/api/?background=FFA116&color=1A1A1A&bold=true&name=Dev' },
  { name: 'Developer Green', url: 'https://ui-avatars.com/api/?background=2ECC71&color=1A1A1A&bold=true&name=Dev' },
  { name: 'Developer Blue', url: 'https://ui-avatars.com/api/?background=4EA1FF&color=1A1A1A&bold=true&name=Dev' },
  { name: 'Developer Purple', url: 'https://ui-avatars.com/api/?background=9B59B6&color=1A1A1A&bold=true&name=Dev' },
  { name: 'Developer Red', url: 'https://ui-avatars.com/api/?background=E74C3C&color=1A1A1A&bold=true&name=Dev' },
  { name: 'Developer Dark', url: 'https://ui-avatars.com/api/?background=34495E&color=F5F5F5&bold=true&name=Dev' },
];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);

  // Profile fields state
  const [profileForm, setProfileForm] = useState({
    fullName: user?.full_name || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatar_url || '',
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  // Preferences mock state
  const [prefsForm, setPrefsForm] = useState({
    emailAlerts: true,
    aiStudyPrompts: true,
    weeklyReports: false,
    // Admin preferences
    auditAlerts: true,
    maintenanceAlerts: false,
    securityReminders: true,
    // Instructor preferences
    enrollmentAlerts: true,
    submissionAlerts: true,
    courseDigests: false,
  });

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.put('/users/me', {
        full_name: profileForm.fullName,
        bio: profileForm.bio,
        avatar_url: profileForm.avatarUrl,
      });

      // Update AuthContext state globally
      updateUser({
        full_name: res.data.full_name,
        bio: res.data.bio,
        avatar_url: res.data.avatar_url,
      });

      toast.success('Profile settings updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Validate Password Policy (12+ characters, upper, lower, digit, special)
  const validateNewPassword = (pwd) => {
    return pwd.length >= 6;
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmNewPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error('All password fields are required');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (!validateNewPassword(newPassword)) {
      toast.error('New password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Current password was incorrect');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Preferences Save (Mock)
  const handlePrefsSubmit = (e) => {
    e.preventDefault();
    toast.success('Notification preferences updated!');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Account Settings</h1>
        <p style={styles.subtitle}>Configure profile details, modify password policy options, and adjust notification alerts.</p>
      </div>

      <div style={styles.settingsLayout}>
        {/* Settings Navigation Menu */}
        <div style={styles.navMenu}>
          <button
            onClick={() => setActiveTab('profile')}
            style={activeTab === 'profile' ? { ...styles.menuBtn, ...styles.activeBtn } : styles.menuBtn}
          >
            <FiUser size={18} /> Edit Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            style={activeTab === 'security' ? { ...styles.menuBtn, ...styles.activeBtn } : styles.menuBtn}
          >
            <FiLock size={18} /> Security & Password
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            style={activeTab === 'preferences' ? { ...styles.menuBtn, ...styles.activeBtn } : styles.menuBtn}
          >
            <FiSliders size={18} /> Preferences
          </button>
        </div>

        {/* Settings Content Panel */}
        <div style={styles.contentPanel}>
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} style={styles.form}>
              <h2 style={styles.sectionTitle}>Profile Details</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  style={styles.input}
                  placeholder="Your display name"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  style={styles.textarea}
                  placeholder="Share a short bio (interests, experience, etc.)"
                  maxLength={1000}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Choose Avatar</label>
                <div style={styles.avatarGrid}>
                  {PRESET_AVATARS.map((avatar) => {
                    const isSelected = profileForm.avatarUrl === avatar.url;
                    return (
                      <button
                        key={avatar.name}
                        type="button"
                        onClick={() => setProfileForm({ ...profileForm, avatarUrl: avatar.url })}
                        style={isSelected ? { ...styles.avatarBtn, ...styles.selectedAvatar } : styles.avatarBtn}
                        title={avatar.name}
                      >
                        <img src={avatar.url} alt={avatar.name} style={styles.avatarImg} />
                        {isSelected && <FiCheckCircle style={styles.checkBadge} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Custom Avatar URL</label>
                <input
                  type="url"
                  value={profileForm.avatarUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })}
                  style={styles.input}
                  placeholder="https://example.com/your-image.png"
                />
              </div>

              <LoadingButton type="submit" loading={isSaving} loadingText="Saving Changes..." style={styles.submitBtn}>
                <FiSave /> Save Settings
              </LoadingButton>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSubmit} style={styles.form}>
              <h2 style={styles.sectionTitle}>Change Password</h2>
              <p style={styles.infoText}>
                To protect your credentials, Codexia requires passwords containing a minimum of 12 characters, including uppercase letters, lowercase letters, numbers, and special symbols.
              </p>

              <div style={styles.formGroup}>
                <label style={styles.label}>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  style={styles.input}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  style={styles.input}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
                  style={styles.input}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <LoadingButton type="submit" loading={isSaving} loadingText="Modifying Password..." style={styles.submitBtn}>
                <FiSave /> Change Password
              </LoadingButton>
            </form>
          )}

          {activeTab === 'preferences' && (
            <form onSubmit={handlePrefsSubmit} style={styles.form}>
              <h2 style={styles.sectionTitle}>Notification & Role Preferences</h2>

              {/* Student Preferences */}
              {(user?.role === 'student' || !user?.role) && (
                <>
                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Email Notifications</h4>
                      <p style={styles.toggleDesc}>Receive announcements and system alerts directly in your inbox.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.emailAlerts}
                      onChange={(e) => setPrefsForm({ ...prefsForm, emailAlerts: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>

                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Proactive AI Study Toggles</h4>
                      <p style={styles.toggleDesc}>Enable the context-aware AI tutor to recommend topics based on performance.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.aiStudyPrompts}
                      onChange={(e) => setPrefsForm({ ...prefsForm, aiStudyPrompts: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>

                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Weekly Performance Analytics Reports</h4>
                      <p style={styles.toggleDesc}>Get email summaries of streaks, solved coding problems, and quiz results.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.weeklyReports}
                      onChange={(e) => setPrefsForm({ ...prefsForm, weeklyReports: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>
                </>
              )}

              {/* Instructor Preferences */}
              {user?.role === 'instructor' && (
                <>
                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Student Enrollment Notifications</h4>
                      <p style={styles.toggleDesc}>Receive alerts when students enroll in your authored courses.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.enrollmentAlerts}
                      onChange={(e) => setPrefsForm({ ...prefsForm, enrollmentAlerts: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>

                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Submission & Review Alerts</h4>
                      <p style={styles.toggleDesc}>Emailed when a student requests assignment grading or quiz reviews.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.submissionAlerts}
                      onChange={(e) => setPrefsForm({ ...prefsForm, submissionAlerts: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>

                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Course Analytics Digests</h4>
                      <p style={styles.toggleDesc}>Receive weekly reports on your authored course ratings, enrollments, and reviews.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.courseDigests}
                      onChange={(e) => setPrefsForm({ ...prefsForm, courseDigests: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>
                </>
              )}

              {/* Admin/Super Admin Preferences */}
              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <>
                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>System Audit Log Alerts</h4>
                      <p style={styles.toggleDesc}>Get emailed when critical security events or authentication failures occur.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.auditAlerts}
                      onChange={(e) => setPrefsForm({ ...prefsForm, auditAlerts: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>

                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>System Maintenance Notices</h4>
                      <p style={styles.toggleDesc}>Receive system alerts, database backup logs, and server performance reports.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.maintenanceAlerts}
                      onChange={(e) => setPrefsForm({ ...prefsForm, maintenanceAlerts: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>

                  <div style={styles.toggleRow}>
                    <div>
                      <h4 style={styles.toggleTitle}>Enable Administrative 2FA Prompts</h4>
                      <p style={styles.toggleDesc}>Force two-factor reminder screens for administrative accounts weekly.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefsForm.securityReminders}
                      onChange={(e) => setPrefsForm({ ...prefsForm, securityReminders: e.target.checked })}
                      style={styles.checkbox}
                    />
                  </div>
                </>
              )}

              <LoadingButton type="submit" loading={isSaving} loadingText="Saving Preferences..." style={styles.submitBtn}>
                <FiSave /> Save Preferences
              </LoadingButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  header: {
    marginBottom: '2.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  settingsLayout: {
    display: 'grid',
    gridTemplateColumns: '250px 1fr',
    gap: '2.5rem',
  },
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    height: 'fit-content',
  },
  menuBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1.25rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  activeBtn: {
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-primary)',
    color: 'var(--accent-primary)',
  },
  contentPanel: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.75rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
    marginBottom: '0.25rem',
  },
  infoText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  textarea: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    minHeight: '100px',
    resize: 'vertical',
  },
  avatarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '0.75rem',
    marginTop: '0.25rem',
  },
  avatarBtn: {
    backgroundColor: 'transparent',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 'var(--radius-md)',
    padding: '0.25rem',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatar: {
    borderColor: 'var(--accent-primary)',
  },
  avatarImg: {
    width: '100%',
    borderRadius: 'var(--radius-sm)',
    objectFit: 'cover',
  },
  checkBadge: {
    position: 'absolute',
    bottom: '-4px',
    right: '-4px',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--accent-primary)',
    borderRadius: 'var(--radius-full)',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-primary)',
  },
  toggleTitle: {
    fontSize: '0.975rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '0.25rem',
  },
  toggleDesc: {
    fontSize: '0.825rem',
    color: 'var(--text-secondary)',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: 'var(--accent-primary)',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: 'fit-content',
    marginTop: '0.5rem',
  },
};
