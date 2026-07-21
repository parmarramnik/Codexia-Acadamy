import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { FiGithub, FiLinkedin, FiGlobe, FiBriefcase, FiAward, FiEdit2, FiLock, FiExternalLink, FiUser } from 'react-icons/fi';

export default function PublicPortfolio() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPublicPortfolio() {
      setIsLoading(true);
      try {
        const res = await api.get(`/career/portfolio/${userId}`);
        setPortfolio(res.data);
      } catch (err) {
        toast.error('Failed to load user portfolio');
      } finally {
        setIsLoading(false);
      }
    }
    loadPublicPortfolio();
  }, [userId]);

  const isOwner = currentUser && portfolio && currentUser.id === portfolio.user_id;

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading user portfolio showcase...</p>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div style={styles.container}>
        <h2 style={{ color: 'var(--text-primary)' }}>Portfolio Not Found</h2>
        <p style={{ color: 'var(--text-secondary)' }}>The requested user portfolio does not exist.</p>
        <Link to="/dashboard" style={styles.backBtn}>Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.headerCard}>
        <div style={styles.headerFlex}>
          <div style={styles.userInfo}>
            <div style={styles.avatarCircle}>
              {portfolio.avatar_url ? (
                <img src={portfolio.avatar_url} alt={portfolio.owner_name} style={styles.avatarImg} />
              ) : (
                <FiUser size={36} style={{ color: 'var(--accent-primary)' }} />
              )}
            </div>
            <div>
              <div style={styles.nameRow}>
                <h1 style={styles.ownerName}>{portfolio.owner_name}</h1>
                {isOwner ? (
                  <span style={styles.ownerBadge}><FiEdit2 /> Your Portfolio</span>
                ) : (
                  <span style={styles.readOnlyBadge}><FiLock /> Read-Only View</span>
                )}
              </div>
              <h3 style={styles.headline}>{portfolio.title || 'Software Engineer Showcase'}</h3>
              <p style={styles.bio}>{portfolio.bio || 'Building modern software applications & mastering AI engineering.'}</p>
            </div>
          </div>

          <div style={styles.actionsBox}>
            {isOwner && (
              <Link to="/career" style={styles.editBtn}>
                <FiEdit2 /> Edit My Portfolio
              </Link>
            )}
            <div style={styles.socialRow}>
              {portfolio.github_url && (
                <a href={portfolio.github_url} target="_blank" rel="noreferrer" style={styles.socialIcon} title="GitHub Profile">
                  <FiGithub size={20} />
                </a>
              )}
              {portfolio.linkedin_url && (
                <a href={portfolio.linkedin_url} target="_blank" rel="noreferrer" style={styles.socialIcon} title="LinkedIn Profile">
                  <FiLinkedin size={20} />
                </a>
              )}
              {portfolio.website_url && (
                <a href={portfolio.website_url} target="_blank" rel="noreferrer" style={styles.socialIcon} title="Portfolio Website">
                  <FiGlobe size={20} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.layoutGrid}>
        {/* Skills & Verified Stack */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}><FiAward style={{ color: 'var(--accent-primary)' }} /> Skills & Tech Stack</h2>
          {portfolio.skills?.length === 0 ? (
            <p style={styles.emptyText}>No verified skills listed yet.</p>
          ) : (
            <div style={styles.skillsGrid}>
              {portfolio.skills?.map((skill, idx) => (
                <span key={idx} style={styles.skillTag}>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Featured Projects */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}><FiBriefcase style={{ color: 'var(--accent-primary)' }} /> Featured Projects ({portfolio.projects?.length || 0})</h2>
          {portfolio.projects?.length === 0 ? (
            <p style={styles.emptyText}>No showcase projects published yet.</p>
          ) : (
            <div style={styles.projectsGrid}>
              {portfolio.projects?.map((proj, idx) => (
                <div key={idx} style={styles.projectCard}>
                  <h3 style={styles.projectTitle}>{proj.name}</h3>
                  <p style={styles.projectDesc}>{proj.description || 'No description provided.'}</p>
                  {proj.url && (
                    <a href={proj.url} target="_blank" rel="noreferrer" style={styles.projectLink}>
                      <FiExternalLink /> View Project Repository
                    </a>
                  )}
                </div>
              ))}
            </div>
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
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  headerCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: 'var(--shadow-md)',
  },
  headerFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1.5rem',
  },
  userInfo: {
    display: 'flex',
    gap: '1.25rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  avatarCircle: {
    width: '72px',
    height: '72px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--bg-secondary)',
    border: '2px solid var(--border-primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.25rem',
  },
  ownerName: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-bold)',
  },
  ownerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: '#0F2C20',
    border: '1px solid #1C5A3E',
    color: '#34D399',
    fontSize: '0.75rem',
    padding: '0.25rem 0.625rem',
    borderRadius: 'var(--radius-full)',
    fontWeight: 'var(--fw-semibold)',
  },
  readOnlyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    color: '#94A3B8',
    fontSize: '0.75rem',
    padding: '0.25rem 0.625rem',
    borderRadius: 'var(--radius-full)',
    fontWeight: 'var(--fw-semibold)',
  },
  headline: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--accent-primary)',
    marginBottom: '0.375rem',
  },
  bio: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    maxWidth: '600px',
  },
  actionsBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '1rem',
  },
  editBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
  socialRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  socialIcon: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    transition: 'all 0.2s ease',
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '2rem',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    boxShadow: 'var(--shadow-md)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  skillsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.625rem',
  },
  skillTag: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.375rem 0.875rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-medium)',
  },
  projectsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  projectCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
  },
  projectTitle: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.375rem',
  },
  projectDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.75rem',
  },
  projectLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: 'var(--accent-primary)',
    fontSize: '0.825rem',
    fontWeight: 'var(--fw-semibold)',
    textDecoration: 'none',
  },
  backBtn: {
    display: 'inline-block',
    marginTop: '1rem',
    color: 'var(--accent-primary)',
    textDecoration: 'none',
  },
};
