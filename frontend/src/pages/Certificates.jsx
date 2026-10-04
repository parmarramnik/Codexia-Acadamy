import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  FiAward, FiDownload, FiCheckCircle, 
  FiEye, FiX, FiExternalLink, FiShield 
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import LoadingButton from '../components/common/LoadingButton';
import PageLoader from '../components/common/PageLoader';
import CertificateDocument from '../components/certificates/CertificateDocument';
import { certificatePdfUrl } from '../utils/certificates';

export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [certsRes, enrolledRes] = await Promise.all([
        api.get('/certificates'),
        api.get('/courses/enrolled/me')
      ]);
      setCertificates(certsRes.data || []);
      setCourses(enrolledRes.data || []);
    } catch (err) {
      toast.error('Failed to load certificates');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateCertificate = async (courseId) => {
    setGeneratingId(courseId);
    try {
      const res = await api.post(`/certificates/${courseId}/generate`);
      toast.success('Certificate issued successfully!');
      setCertificates((prev) => (prev.some((c) => c.id === res.data.id) ? prev : [res.data, ...prev]));
      setPreviewCert(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'You must complete at least 80% of the course lectures to earn a certificate.');
    } finally {
      setGeneratingId(null);
    }
  };

  if (user?.role !== 'student') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Verified Certificates</h1>
          <p style={styles.subtitle}>Verified course completion certificates.</p>
        </div>
        <div style={styles.roleNoticeContainer}>
          <FiAward size={64} style={styles.roleNoticeIcon} />
          <h3 style={styles.roleNoticeTitle}>Student Feature Only</h3>
          <p style={styles.roleNoticeDesc}>
            Only student accounts can enroll in courses, track study progress, and claim official completion certificates.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Verified Certificates</h1>
        <p style={styles.subtitle}>Claim, inspect, and download your accredited course completion credentials.</p>
      </div>

      <div className="r-stack" style={styles.grid}>
        {/* Certificate Generation / Eligible Courses */}
        <div style={styles.boxCard}>
          <h2 style={styles.sectionHeading}>Earn Certificates</h2>
          <p style={styles.descText}>Complete at least 80% of any course syllabus lectures to request your official credential.</p>
          <div style={styles.coursesList}>
            {courses.length === 0 ? (
              <p style={styles.emptyText}>You are not enrolled in any courses.</p>
            ) : (
              courses.map((enrollment) => {
                const hasCert = certificates.some(c => c.course_id === enrollment.course_id);
                return (
                  <div key={enrollment.id} style={styles.courseItem}>
                    <div style={styles.courseDetails}>
                      <span style={styles.courseTitle}>{enrollment.course.title}</span>
                      <span style={styles.courseProgress}>Syllabus completed: {Math.round(enrollment.completion_percentage)}%</span>
                    </div>
                    {hasCert ? (
                      <span style={styles.claimedText}><FiCheckCircle /> Claimed</span>
                    ) : (enrollment.completion_percentage || 0) < 80 ? (
                      <span style={styles.lockedText}>{80 - Math.round(enrollment.completion_percentage || 0)}% to go</span>
                    ) : (
                      <LoadingButton
                        onClick={() => handleGenerateCertificate(enrollment.course_id)}
                        loading={generatingId === enrollment.course_id}
                        disabled={generatingId !== null}
                        loadingText="Claiming..."
                        style={styles.claimBtn}
                      >
                        Claim Certificate
                      </LoadingButton>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Claimed Certificates Portfolio */}
        <div style={styles.portfolioBox}>
          <h2 style={styles.sectionHeading}>My Portfolio</h2>
          {certificates.length === 0 ? (
            <div style={styles.emptyPortfolio}>
              <FiAward size={48} style={styles.emptyIcon} />
              <p>You have not earned any certificates yet. Complete course modules to claim.</p>
            </div>
          ) : (
            <div style={styles.certificatesList}>
              {certificates.map((cert) => (
                <div key={cert.id} style={styles.certCard}>
                  <div style={styles.certIconWrapper}>
                    <FiAward size={24} style={styles.certIcon} />
                  </div>
                  <div style={styles.certInfo}>
                    <h3 style={styles.certCourse}>{cert.course_title}</h3>
                    <span style={styles.certUid}>ID: {cert.credential_id || cert.certificate_uid}</span>
                    <span style={styles.certDate}>Issued on: {new Date(cert.completion_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setPreviewCert(cert)}
                      style={styles.previewBtn}
                    >
                      <FiEye size={14} /> View
                    </button>
                    <a
                      href={certificatePdfUrl(cert.certificate_uid, { download: true })}
                      style={styles.downloadLink}
                    >
                      <FiDownload size={14} /> Download PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Official Certificate Preview Modal */}
      {previewCert && (
        <div style={styles.modalBackdrop} onClick={() => setPreviewCert(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalCloseBtn} onClick={() => setPreviewCert(null)} title="Close Preview">
              <FiX size={20} />
            </button>

            <CertificateDocument certificate={previewCert} />

            {/* Modal Actions */}
            <div style={styles.modalActionsBar}>
              <Link
                to={`/verify/${previewCert.certificate_uid}`}
                target="_blank"
                style={styles.modalVerifyLink}
              >
                <FiExternalLink size={15} /> Open Verification Registry
              </Link>
              <a
                href={certificatePdfUrl(previewCert.certificate_uid, { download: true })}
                style={styles.modalDownloadBtn}
              >
                <FiDownload size={15} /> Download Official PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '0 0 2rem 0',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  roleNoticeContainer: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '2rem',
  },
  roleNoticeIcon: {
    color: 'var(--accent-primary)',
    marginBottom: '0.5rem',
  },
  roleNoticeTitle: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-medium)',
  },
  roleNoticeDesc: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    maxWidth: '480px',
    lineHeight: '1.5',
  },
  header: {
    marginBottom: '2rem',
  },
  title: {
    fontSize: 'clamp(1.4rem, 2.2vw, 1.75rem)',
    fontWeight: 'var(--fw-semibold)',
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    lineHeight: 1.55,
    maxWidth: '680px',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1.8fr',
    gap: '2.5rem',
  },
  boxCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    height: 'fit-content',
  },
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  descText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  coursesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  courseItem: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  courseDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  courseTitle: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
  },
  courseProgress: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  claimBtn: {
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  lockedText: {
    color: 'var(--text-3)',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  },
  claimedText: {
    color: 'var(--color-success)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontWeight: 'var(--fw-medium)',
  },
  portfolioBox: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  emptyPortfolio: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  emptyIcon: {
    color: 'var(--text-secondary)',
  },
  certificatesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  certCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  certIconWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certIcon: {
    color: 'var(--accent-primary)',
  },
  certInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  certCourse: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
  },
  certUid: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
  },
  certDate: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  downloadLink: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  previewBtn: {
    backgroundColor: 'var(--primary)',
    color: '#FFF',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: '1.5rem',
    overflowY: 'auto',
  },
  modalContent: {
    position: 'relative',
    maxWidth: '860px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: '-2.5rem',
    right: 0,
    backgroundColor: 'var(--border-primary)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'var(--text-primary)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  modalActionsBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
  modalVerifyLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
  },
  modalDownloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#FFF',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-bold)',
    boxShadow: '0 4px 15px var(--primary-subtle-border)',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
};
