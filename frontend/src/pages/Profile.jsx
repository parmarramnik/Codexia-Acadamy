import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiUser, FiActivity, FiAward, FiBookOpen, FiCode, FiClock, FiSettings, FiCheckCircle, FiShare2 } from 'react-icons/fi';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_courses_enrolled: 0,
    completed_courses: 0,
    total_study_hours: 0,
    quizzes_taken: 0,
    average_quiz_score: 0,
    problems_solved: 0,
    current_streak: 0,
    certificates_earned: 0,
  });
  const [certificates, setCertificates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfileData() {
      try {
        const [statsRes, certsRes] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/certificates')
        ]);
        setStats(statsRes.data);
        setCertificates(certsRes.data || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load profile details');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfileData();
  }, []);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading profile...</p>
      </div>
    );
  }

  // Fallback avatar generator using UI Avatars
  const avatarUrl = user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'User')}&background=FFA116&color=1A1A1A&size=128&bold=true`;

  return (
    <div style={styles.container}>
      <div style={styles.profileLayout}>
        {/* Left Card: Info & Quick Links */}
        <div style={styles.leftCol}>
          <div style={styles.profileCard}>
            <div style={styles.avatarWrapper}>
              <img src={avatarUrl} alt="Avatar" style={styles.avatarImg} />
            </div>
            <h2 style={styles.fullName}>{user?.full_name}</h2>
            <p style={styles.username}>@{user?.username}</p>
            <span style={styles.roleBadge}>{user?.role?.toUpperCase()}</span>
            
            <p style={styles.bioText}>
              {user?.bio || "No bio added yet. Tell Codexia Academy about your career path!"}
            </p>

            <div style={styles.divider}></div>

            <button onClick={() => navigate('/settings')} style={styles.settingsBtn}>
              <FiSettings /> Edit Profile Settings
            </button>
          </div>
        </div>

        {/* Right Side: Stats, Badges, Certifications */}
        <div style={styles.rightCol}>
          {/* Stats Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statIconCol}><FiBookOpen size={24} style={styles.accentIcon} /></div>
              <div>
                <h4 style={styles.statValue}>{stats.total_courses_enrolled}</h4>
                <p style={styles.statLabel}>Enrolled Courses</p>
              </div>
            </div>

            <div style={styles.statBox}>
              <div style={styles.statIconCol}><FiCode size={24} style={styles.accentIcon} /></div>
              <div>
                <h4 style={styles.statValue}>{stats.problems_solved}</h4>
                <p style={styles.statLabel}>Code Solved</p>
              </div>
            </div>

            <div style={styles.statBox}>
              <div style={styles.statIconCol}><FiActivity size={24} style={styles.accentIcon} /></div>
              <div>
                <h4 style={styles.statValue}>{stats.current_streak} days</h4>
                <p style={styles.statLabel}>Current Streak</p>
              </div>
            </div>

            <div style={styles.statBox}>
              <div style={styles.statIconCol}><FiAward size={24} style={styles.accentIcon} /></div>
              <div>
                <h4 style={styles.statValue}>{certificates.length}</h4>
                <p style={styles.statLabel}>Achievements</p>
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div style={styles.portfolioSection}>
            <h3 style={styles.sectionHeading}>Verified Credentials</h3>
            {certificates.length === 0 ? (
              <div style={styles.emptyPortfolio}>
                <FiAward size={40} style={styles.emptyIcon} />
                <p style={styles.emptyText}>No verified certificates earned yet. Complete courses to unlock credentials.</p>
                <Link to="/courses" style={styles.browseBtn}>Browse Courses</Link>
              </div>
            ) : (
              <div style={styles.certList}>
                {certificates.map((cert) => (
                  <div key={cert.id} style={styles.certCard}>
                    <div style={styles.certIconBg}>
                      <FiAward size={22} style={styles.accentIcon} />
                    </div>
                    <div style={styles.certInfo}>
                      <h4 style={styles.certTitle}>{cert.course_title}</h4>
                      <p style={styles.certMeta}>
                        Verifiable ID: <span style={styles.codeText}>{cert.certificate_uid}</span> • Issued on {new Date(cert.completion_date).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={cert.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.viewCertLink}
                    >
                      Verify PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skill Radar Mock / Learning Badges */}
          <div style={styles.portfolioSection}>
            <h3 style={styles.sectionHeading}>My Badges & Skills</h3>
            <div style={styles.badgesGrid}>
              <div style={styles.badgeItem}>
                <span style={styles.badgeEmoji}>⚡</span>
                <span style={styles.badgeName}>Quick Learner</span>
              </div>
              <div style={styles.badgeItem}>
                <span style={styles.badgeEmoji}>💻</span>
                <span style={styles.badgeName}>Code Solver</span>
              </div>
              <div style={styles.badgeItem}>
                <span style={styles.badgeEmoji}>🤖</span>
                <span style={styles.badgeName}>AI Explorer</span>
              </div>
              <div style={styles.badgeItem}>
                <span style={styles.badgeEmoji}>🔥</span>
                <span style={styles.badgeName}>Streak Builder</span>
              </div>
            </div>
          </div>
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
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
  },
  profileLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '2.5rem',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  profileCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: '120px',
    height: '120px',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
    border: '3px solid var(--accent-primary)',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  fullName: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
  },
  username: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
  },
  roleBadge: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    backgroundColor: 'var(--accent-light)',
    color: 'var(--accent-primary)',
    border: '1px solid var(--accent-primary)',
    padding: '0.25rem 0.75rem',
    borderRadius: 'var(--radius-full)',
    marginBottom: '1.5rem',
  },
  bioText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  divider: {
    width: '100%',
    height: '1px',
    backgroundColor: 'var(--border-primary)',
    margin: '1.5rem 0',
  },
  settingsBtn: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1.25rem',
  },
  statBox: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  statIconCol: {
    width: '44px',
    height: '44px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentIcon: {
    color: 'var(--accent-primary)',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  portfolioSection: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sectionHeading: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-semibold)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  emptyPortfolio: {
    textAlign: 'center',
    padding: '3rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  emptyIcon: {
    color: 'var(--text-secondary)',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  browseBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  certList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  certCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  certIconBg: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  certTitle: {
    fontSize: '0.975rem',
    fontWeight: 'var(--fw-medium)',
  },
  certMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  codeText: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-primary)',
  },
  viewCertLink: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
  },
  badgesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '1rem',
  },
  badgeItem: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    textAlign: 'center',
  },
  badgeEmoji: {
    fontSize: '1.75rem',
  },
  badgeName: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-secondary)',
  },
};
