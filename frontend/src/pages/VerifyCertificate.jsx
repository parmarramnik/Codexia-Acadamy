import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { FiAward, FiCheckCircle, FiAlertTriangle, FiArrowLeft, FiDownload, FiShield } from 'react-icons/fi';

export default function VerifyCertificate() {
  const { uid } = useParams();
  const [certData, setCertData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const getFullCertUrl = (relativeUrl) => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    const backendHost = api.defaults.baseURL.replace(/\/api$/, '');
    return `${backendHost}${relativeUrl}`;
  };

  useEffect(() => {
    async function verify() {
      setIsLoading(true);
      try {
        const res = await api.get(`/certificates/${uid}/verify`);
        setCertData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid or expired certificate ID.');
      } finally {
        setIsLoading(false);
      }
    }
    if (uid) verify();
  }, [uid]);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Verifying credential authenticity against Codexia registry...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <Link to="/" style={styles.backBtn}>
            <FiArrowLeft /> Back to Codexia
          </Link>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>codexia.edu/verify</span>
        </div>

        {error ? (
          <div style={styles.statusBox}>
            <FiAlertTriangle size={64} style={styles.errorIcon} />
            <h1 style={styles.errorTitle}>Verification Failed</h1>
            <p style={styles.errorText}>{error}</p>
            <div style={styles.divider}></div>
            <span style={styles.uidText}>UID: {uid}</span>
          </div>
        ) : (
          <div style={styles.statusBox}>
            {/* Academy Branding */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 900, color: 'var(--accent-primary)', fontSize: '1.15rem', letterSpacing: '0.5px' }}>
                &lt; CODEXIA ACADEMY /&gt;
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}>
                ACCREDITED INSTITUTE OF COMPUTER SCIENCE & ARTIFICIAL INTELLIGENCE
              </div>
            </div>

            <div style={styles.badgeWrapper}>
              <FiAward size={72} style={{ color: '#D4AF37' }} />
              <FiCheckCircle size={28} style={styles.checkIcon} />
            </div>

            <h1 style={styles.title}>Officially Verified Credential</h1>
            <p style={styles.subtitle}>This certificate is authentic, fully accredited, and registered in Codexia records.</p>
            
            <div style={styles.detailsGrid}>
              <div style={styles.detailRow}>
                <span style={styles.label}>Recipient Scholar</span>
                <span style={{ ...styles.value, fontWeight: 700 }}>{certData.user_full_name}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.label}>Course Curriculum</span>
                <span style={{ ...styles.value, color: 'var(--accent-primary)', fontWeight: 600 }}>{certData.course_title}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.label}>Authorized Faculty Instructor</span>
                <span style={styles.value}>{certData.instructor_name}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.label}>Date of Completion</span>
                <span style={styles.value}>
                  {new Date(certData.completion_date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.label}>Accreditation Status</span>
                <span style={{ ...styles.value, color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCheckCircle size={14} /> Valid & Active
                </span>
              </div>
            </div>

            <div style={styles.divider}></div>
            <span style={styles.uidText}>CERTIFICATE ID : {certData.certificate_uid}</span>

            {certData.certificate_url && (
              <a
                href={getFullCertUrl(certData.certificate_url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: '1.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#FFF',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                }}
              >
                <FiDownload /> Download Official PDF Certificate
              </a>
            )}
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
    background: 'radial-gradient(circle at top, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
    padding: '1.5rem',
    color: 'var(--text-primary)',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    backdropFilter: 'blur(10px)',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '2rem',
    alignSelf: 'flex-start',
    transition: 'color 0.2s',
    ':hover': {
      color: 'var(--accent-primary)',
    },
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border-primary)',
    borderTopColor: 'var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    alignSelf: 'center',
    marginBottom: '1rem',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  statusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  badgeWrapper: {
    position: 'relative',
    marginBottom: '1.5rem',
  },
  awardIcon: {
    color: 'var(--accent-primary)',
  },
  checkIcon: {
    position: 'absolute',
    bottom: '-5px',
    right: '-5px',
    color: 'var(--color-success)',
    backgroundColor: 'var(--bg-card)',
    borderRadius: '50%',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    maxWidth: '380px',
    lineHeight: '1.5',
  },
  detailsGrid: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    marginBottom: '1.5rem',
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-medium)',
  },
  divider: {
    width: '100%',
    height: '1px',
    backgroundColor: 'var(--border-primary)',
    marginBottom: '1rem',
  },
  uidText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  errorIcon: {
    color: 'var(--color-error)',
    marginBottom: '1.5rem',
  },
  errorTitle: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    lineHeight: '1.5',
  },
};
