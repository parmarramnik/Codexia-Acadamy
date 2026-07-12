import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiAward, FiDownload, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function Certificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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
      // Use actual user enrollments
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
          <h1 style={styles.title}>Certificates & Achievements</h1>
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
        <h1 style={styles.title}>Certificates & Achievements</h1>
        <p style={styles.subtitle}>Claim and download your verified course completion certificates.</p>
      </div>

      <div style={styles.grid}>
        {/* Certificate Generation / Eligible Courses */}
        <div style={styles.boxCard}>
          <h2 style={styles.sectionHeading}>Earn Certificates</h2>
          <p style={styles.descText}>Complete at least 80% of any course syllabus lectures to request your official certificate.</p>
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
                      <button
                        onClick={() => handleGenerateCertificate(enrollment.course_id)}
                        disabled={isGenerating}
                        style={styles.claimBtn}
                      >
                        Claim Certificate
                      </button>
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
                    <span style={styles.certDate}>Issued on: {new Date(cert.completion_date).toLocaleDateString()}</span>
                  </div>
                  <a
                    href={getFullCertUrl(cert.certificate_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.downloadLink}
                  >
                    <FiDownload /> Download PDF
                  </a>
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
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
};
