import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { FiCheckCircle, FiAlertTriangle, FiAward, FiCalendar, FiUser, FiInfo } from 'react-icons/fi';

export default function VerifyCertificatePublic() {
  const { uid } = useParams();
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function performVerification() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get(`/certificates/verify/${uid}`);
        setVerification(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid certificate hash ID or revoked credential.');
      } finally {
        setIsLoading(false);
      }
    }
    if (uid) {
      performVerification();
    }
  }, [uid]);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ color: 'var(--text-secondary)' }}>Checking verification registers with Codexia platform databases...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.decorBar}></div>
        {error ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <FiAlertTriangle size={48} style={{ color: 'var(--color-error)', marginBottom: '1rem' }} />
            <h2 style={styles.errorTitle}>Verification Failed</h2>
            <p style={styles.errorText}>{error}</p>
          </div>
        ) : (
          <div>
            {/* Verified Badge Header */}
            <div style={styles.verifiedHeader}>
              <FiCheckCircle size={28} style={{ color: 'var(--color-success)' }} />
              <div>
                <span style={styles.badgeText}>OFFICIALLY VERIFIED CREDENTIAL</span>
                <div style={styles.issueAuthority}>{verification.issue_authority}</div>
              </div>
            </div>

            {/* Certificate ID */}
            <div style={styles.uidContainer}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CERTIFICATE UUID</span>
              <div style={styles.uidText}>{verification.certificate_uid}</div>
            </div>

            {/* Recipient Details */}
            <div style={styles.detailRow}>
              <FiUser size={18} style={styles.icon} />
              <div>
                <span style={styles.label}>Recipient Name</span>
                <div style={styles.value}>{verification.recipient}</div>
              </div>
            </div>

            <div style={styles.detailRow}>
              <FiAward size={18} style={styles.icon} />
              <div>
                <span style={styles.label}>Course Completed</span>
                <div style={styles.value}>{verification.course_title}</div>
              </div>
            </div>

            <div style={styles.detailRow}>
              <FiInfo size={18} style={styles.icon} />
              <div>
                <span style={styles.label}>Authorized Instructor Signature</span>
                <div style={styles.value}>{verification.instructor}</div>
              </div>
            </div>

            <div style={styles.detailRow}>
              <FiCalendar size={18} style={styles.icon} />
              <div>
                <span style={styles.label}>Issue Date</span>
                <div style={styles.value}>{new Date(verification.completion_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={styles.disclaimer}>
              This digital certificate verifies that the recipient has successfully completed all syllabus modules, quizzes, and programming practices for the designated course path on Codexia Academy.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    padding: '2rem',
    color: 'var(--text-primary)'
  },
  card: {
    position: 'relative',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
    overflow: 'hidden'
  },
  decorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '4px',
    backgroundColor: 'var(--accent-primary)'
  },
  verifiedHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '1.25rem',
    marginBottom: '1.5rem'
  },
  badgeText: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--color-success)',
    letterSpacing: '1px'
  },
  issueAuthority: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)'
  },
  uidContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem'
  },
  uidText: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: 'var(--accent-primary)',
    marginTop: '0.25rem'
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1.25rem'
  },
  icon: {
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
    flexShrink: 0
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)'
  },
  value: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
    marginTop: '0.1rem'
  },
  disclaimer: {
    marginTop: '2rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid var(--border-primary)',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    textAlign: 'center'
  },
  errorTitle: {
    fontSize: '1.4rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--color-error)',
    marginBottom: '0.5rem'
  },
  errorText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4'
  }
};
