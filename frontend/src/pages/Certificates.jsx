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

export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewCert, setPreviewCert] = useState(null);

  const getFullCertUrl = (relativeUrl) => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    const backendHost = api.defaults.baseURL.replace(/\/api$/, '');
    return `${backendHost}${relativeUrl}`;
  };

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
    setIsGenerating(true);
    try {
      const res = await api.post(`/certificates/${courseId}/generate`);
      toast.success('Certificate generated successfully!');
      setCertificates(prev => [res.data, ...prev]);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'You must complete at least 80% of the course lectures to earn a certificate.');
    } finally {
      setIsGenerating(false);
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
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading certificates portfolio...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Verified Certificates</h1>
        <p style={styles.subtitle}>Claim, inspect, and download your accredited course completion credentials.</p>
      </div>

      <div style={styles.grid}>
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
                    ) : (
                      <LoadingButton
                        onClick={() => handleGenerateCertificate(enrollment.course_id)}
                        loading={isGenerating}
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
                    <span style={styles.certUid}>ID: {cert.certificate_uid}</span>
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
                      href={getFullCertUrl(cert.certificate_url)}
                      target="_blank"
                      rel="noopener noreferrer"
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

            {/* Prestige Academic Certificate Frame */}
            <div style={styles.certFrame}>
              {/* Corner Accents */}
              <div style={{ ...styles.certCorner, top: '12px', left: '12px', borderTop: '2px solid #C5A059', borderLeft: '2px solid #C5A059' }} />
              <div style={{ ...styles.certCorner, top: '12px', right: '12px', borderTop: '2px solid #C5A059', borderRight: '2px solid #C5A059' }} />
              <div style={{ ...styles.certCorner, bottom: '12px', left: '12px', borderBottom: '2px solid #C5A059', borderLeft: '2px solid #C5A059' }} />
              <div style={{ ...styles.certCorner, bottom: '12px', right: '12px', borderBottom: '2px solid #C5A059', borderRight: '2px solid #C5A059' }} />

              {/* Academy Header */}
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={styles.certAcademyBrand}>CODEXIA ACADEMY</div>
                <div style={styles.certAcademyTagline}>ACCREDITED PLATFORM OF SOFTWARE ARCHITECTURE & ARTIFICIAL INTELLIGENCE</div>
                <div style={styles.certAcademyUrl}>OFFICIAL VERIFIED ACADEMIC CREDENTIAL • HTTP://CODEXIA.EDU</div>
                <div style={styles.certGoldDivider} />
              </div>

              {/* Certificate Title */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={styles.certMainTitle}>CERTIFICATE OF COMPLETION</h2>
                <div style={styles.certSubCertify}>THIS IS TO OFFICIALLY CERTIFY THAT</div>
                <div style={styles.certRecipientName}>{previewCert.user_full_name || 'Student Scholar'}</div>
                <div style={styles.certNameDivider} />
                <p style={styles.certNarrative}>
                  has successfully demonstrated technical mastery, passed practical assessments, and fulfilled all requirements for
                </p>
                <div style={styles.certCourseTitle}>{previewCert.course_title}</div>
                <div style={styles.certAccreditationText}>Comprehensive Curriculum • Verified Practical Assessments • Demonstrated Competency</div>
              </div>

              {/* Three Column Signature Block & Official Seal */}
              <div style={styles.certSignatureRow}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={styles.certScriptSig}>{previewCert.instructor_name || 'Authorized Instructor'}</div>
                  <div style={styles.certSigLine} />
                  <div style={styles.certSigName}>{previewCert.instructor_name || 'Authorized Instructor'}</div>
                  <div style={styles.certSigRole}>Authorized Course Instructor</div>
                  <div style={styles.certSigOrg}>Codexia Academic Faculty</div>
                </div>

                <div style={styles.certSealBadge}>
                  <div style={styles.certRibbonContainer}>
                    <div style={styles.certRibbonLeft} />
                    <div style={styles.certRibbonRight} />
                    <div style={styles.certSealRing}>
                      <div style={styles.certSealInner}>
                        <span style={{ fontSize: '0.45rem', color: '#FEF3C7', letterSpacing: '1px' }}>★ ★ ★</span>
                        <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#FEF3C7', letterSpacing: '0.5px', marginTop: '1px' }}>CODEXIA</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#C5A059' }}>ACADEMY</span>
                        <span style={{ fontSize: '0.45rem', fontWeight: 700, color: '#FFFFFF', marginTop: '1px' }}>OFFICIAL SEAL</span>
                        <span style={{ fontSize: '0.4rem', color: '#94A3B8' }}>• 2026 •</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={styles.certScriptSig}>Office of Academic Affairs</div>
                  <div style={styles.certSigLine} />
                  <div style={styles.certSigName}>Office of Academic Affairs</div>
                  <div style={styles.certSigRole}>Academic Directorate</div>
                  <div style={styles.certSigOrg}>Codexia Academy International</div>
                </div>
              </div>

              {/* Footer Security Identifiers */}
              <div style={styles.certFooterRow}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: '#475569', fontWeight: 600 }}>
                    CERTIFICATE UID : {previewCert.certificate_uid}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748B', marginTop: '2px' }}>
                    ISSUED ON : {new Date(previewCert.completion_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.725rem', color: '#1E3A8A', fontWeight: 600 }}>
                    REGISTRY: codexia.edu/verify/{previewCert.certificate_uid}
                  </span>
                </div>
              </div>
            </div>

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
                href={getFullCertUrl(previewCert.certificate_url)}
                target="_blank"
                rel="noopener noreferrer"
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
    padding: '2rem',
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
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
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
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.75rem',
    cursor: 'pointer',
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
    backgroundColor: 'var(--accent-primary)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#FFF',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  certFrame: {
    position: 'relative',
    backgroundColor: '#FCFBF7',
    border: '3px solid #0F172A',
    borderRadius: '6px',
    padding: '2.5rem 2.25rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), inset 0 0 0 3px #FFFFFF, inset 0 0 0 5px #C5A059, inset 0 0 0 7px #0F172A',
    color: '#0F172A',
  },
  certCorner: {
    position: 'absolute',
    width: '24px',
    height: '24px',
  },
  certAcademyBrand: {
    color: '#0F172A',
    fontWeight: 900,
    fontSize: '1.35rem',
    letterSpacing: '1.5px',
  },
  certAcademyTagline: {
    color: '#996515',
    fontSize: '0.675rem',
    fontWeight: 700,
    letterSpacing: '0.8px',
    marginTop: '3px',
  },
  certAcademyUrl: {
    color: '#64748B',
    fontSize: '0.625rem',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  certGoldDivider: {
    width: '240px',
    height: '1px',
    backgroundColor: '#C5A059',
    margin: '10px auto 0',
  },
  certMainTitle: {
    fontSize: '1.65rem',
    fontWeight: 900,
    color: '#0F172A',
    letterSpacing: '1px',
    margin: 0,
  },
  certSubCertify: {
    fontSize: '0.75rem',
    color: '#475569',
    letterSpacing: '1px',
    marginTop: '6px',
    fontWeight: 600,
  },
  certRecipientName: {
    fontSize: '1.9rem',
    fontWeight: 800,
    color: '#0F172A',
    marginTop: '8px',
    letterSpacing: '0.5px',
  },
  certNameDivider: {
    width: '260px',
    height: '2px',
    backgroundColor: '#C5A059',
    margin: '8px auto 12px',
  },
  certNarrative: {
    fontSize: '0.8rem',
    color: '#475569',
    maxWidth: '650px',
    margin: '0 auto',
    lineHeight: '1.5',
  },
  certCourseTitle: {
    fontSize: '1.35rem',
    fontWeight: 800,
    color: '#1E3A8A',
    marginTop: '12px',
    maxWidth: '700px',
    margin: '12px auto 4px',
    lineHeight: '1.35',
  },
  certAccreditationText: {
    fontSize: '0.7rem',
    color: '#64748B',
    fontStyle: 'italic',
  },
  certSignatureRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '2rem',
    padding: '0 1.5rem',
  },
  certScriptSig: {
    fontStyle: 'italic',
    color: '#0F172A',
    fontSize: '1.15rem',
    fontWeight: 700,
    marginBottom: '2px',
  },
  certSigLine: {
    width: '180px',
    height: '1px',
    backgroundColor: '#CBD5E1',
    margin: '0 auto 6px',
  },
  certSigName: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#0F172A',
  },
  certSigRole: {
    fontSize: '0.7rem',
    color: '#475569',
    marginTop: '2px',
  },
  certSigOrg: {
    fontSize: '0.65rem',
    color: '#64748B',
  },
  certSealBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certRibbonContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certRibbonLeft: {
    position: 'absolute',
    bottom: '-12px',
    left: '14px',
    width: '14px',
    height: '24px',
    backgroundColor: '#996515',
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
    zIndex: 1,
    transform: 'rotate(-12deg)',
  },
  certRibbonRight: {
    position: 'absolute',
    bottom: '-12px',
    right: '14px',
    width: '14px',
    height: '24px',
    backgroundColor: '#996515',
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
    zIndex: 1,
    transform: 'rotate(12deg)',
  },
  certSealRing: {
    position: 'relative',
    zIndex: 2,
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    border: '2.5px solid #C5A059',
    outline: '1px solid #996515',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25), inset 0 0 0 2px #FFFFFF, inset 0 0 0 3px #C5A059',
  },
  certSealInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: '1.2',
  },
  certFooterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: '1.75rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(212, 175, 55, 0.2)',
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
    backgroundColor: 'var(--accent-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#FFF',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-bold)',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
};
