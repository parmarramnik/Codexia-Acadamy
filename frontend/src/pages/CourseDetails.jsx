import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { FiBookOpen, FiClock, FiCpu, FiCheck, FiFolder, FiPlay, FiCheckCircle } from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function CourseDetails() {
  const { slug } = useParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [completedLectures, setCompletedLectures] = useState([]);

  useEffect(() => {
    async function fetchCourseDetails() {
      setIsLoading(true);
      try {
        const courseRes = await api.get(`/courses/${slug}`);
        setCourse(courseRes.data);

        // Fetch modules
        const modulesRes = await api.get(`/courses/${courseRes.data.id}/modules`);
        setModules(modulesRes.data || []);

        // Check if user is enrolled and check certificate eligibility
        if (isAuthenticated) {
          try {
            const [enrollmentsRes, certsRes, progressRes] = await Promise.all([
              api.get('/courses/enrolled/me'),
              api.get('/certificates').catch(() => ({ data: [] })),
              api.get(`/courses/${courseRes.data.id}/progress`).catch(() => ({ data: [] }))
            ]);
            const enrolledList = enrollmentsRes.data || [];
            const enrollmentObj = enrolledList.find(e => e.course_id === courseRes.data.id);
            setIsEnrolled(!!enrollmentObj);
            if (enrollmentObj) {
              setCompletionPercentage(enrollmentObj.completion_percentage || 0);
            }
            
            const certsList = certsRes.data || [];
            const hasExistingCert = certsList.some(c => c.course_id === courseRes.data.id);
            setHasCertificate(hasExistingCert);

            setCompletedLectures(progressRes.data || []);
          } catch (e) {
            console.error('Error fetching enrollment/cert/progress details:', e);
          }
        }
      } catch (err) {
        toast.error('Failed to load course details');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCourseDetails();
  }, [slug, isAuthenticated]);

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to enroll in this course');
      navigate('/login');
      return;
    }

    setIsEnrolling(true);
    try {
      await api.post(`/courses/${course.id}/enroll`);
      toast.success('Successfully enrolled!');
      setIsEnrolled(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Enrollment failed');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleClaimCertificate = async () => {
    if (!course) return;
    setIsClaiming(true);
    try {
      await api.post(`/certificates/${course.id}/generate`);
      toast.success('Certificate claimed successfully! Redirecting...');
      setHasCertificate(true);
      setTimeout(() => navigate('/certificates'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to claim certificate');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading course details...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={styles.emptyState}>
        <h3>Course Not Found</h3>
        <Link to="/courses" style={styles.backLink}>Back to Courses</Link>
      </div>
    );
  }

  // Get first lecture link for Continue Learning
  const firstLectureId = modules[0]?.lectures[0]?.id;

  return (
    <div style={styles.container}>
      {/* Course Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerContent}>
          <div style={styles.tagRow}>
            <span style={styles.categoryBadge}>{course.category.replace('_', ' ')}</span>
            <span style={styles.difficultyBadge}>{course.difficulty}</span>
          </div>
          <h1 style={styles.title}>{course.title}</h1>
          <p style={styles.description}>{course.short_description || course.description}</p>
          <div style={styles.metaRow}>
            <span style={styles.metaItem}><FiClock /> {course.duration_hours || 10} Hours</span>
            <span style={styles.metaItem}><FiBookOpen /> {course.total_lectures || 0} Lectures</span>
            <span style={styles.metaItem}>Instructor: {course.instructor_name || 'Codexia'}</span>
          </div>
        </div>

        <div style={styles.bannerSidebar}>
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} style={styles.thumbnail} />
          ) : (
            <div style={styles.thumbnailPlaceholder}>
              <FiBookOpen size={48} />
            </div>
          )}
          <div style={styles.actionBox}>
            {!isAuthenticated || user?.role === 'student' ? (
              <>
                <span style={styles.price}>{course.price === 0 ? 'Free' : `$${course.price}`}</span>
                {isEnrolled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                    {firstLectureId ? (
                      <Link to={`/courses/${course.slug}/learn/${firstLectureId}`} style={styles.enrollBtn}>
                        <FiPlay /> Resume Learning
                      </Link>
                    ) : (
                      <button disabled style={styles.enrollBtnDisabled}>Enrolled (No Lectures)</button>
                    )}
                    
                    {hasCertificate ? (
                      <Link to="/certificates" style={styles.viewCertBtn}>
                        🏆 View Certificate
                      </Link>
                    ) : (
                      completionPercentage >= 80 && (
                        <LoadingButton
                          onClick={handleClaimCertificate}
                          loading={isClaiming}
                          loadingText="Claiming..."
                          style={styles.claimCertBtn}
                        >
                          🏆 Claim Certificate
                        </LoadingButton>
                      )
                    )}
                  </div>
                ) : (
                  <LoadingButton
                    onClick={handleEnroll}
                    loading={isEnrolling}
                    loadingText="Enrolling..."
                    style={styles.enrollBtn}
                  >
                    Enroll Now
                  </LoadingButton>
                )}
              </>
            ) : (
              <div style={styles.roleNoticeBox}>
                <p style={styles.roleNoticeText}>
                  Viewing as <strong>{user.role.replace('_', ' ')}</strong>
                </p>
                {course.instructor_id === user.id ? (
                  <Link to="/dashboard" style={styles.manageBtn}>
                    Manage Syllabus
                  </Link>
                ) : (
                  <p style={styles.roleNoticeSub}>Instructors and Admins manage courses and content via the dashboard.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Info */}
      <div style={styles.contentGrid}>
        <div style={styles.mainContent}>
          <h2 style={styles.sectionTitle}>Course Description</h2>
          <p style={styles.fullDesc}>{course.description}</p>

          {course.learning_objectives && (
            <>
              <h2 style={styles.sectionTitle}>What You Will Learn</h2>
              <div style={styles.objectivesGrid}>
                {course.learning_objectives.split('\n').map((obj, i) => (
                  <div key={i} style={styles.objectiveItem}>
                    <FiCheck style={styles.checkIcon} />
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Syllabus Modules */}
          <h2 style={styles.sectionTitle}>Syllabus</h2>
          <div style={styles.modulesList}>
            {modules.length === 0 ? (
              <p style={styles.noModules}>No modules listed yet for this course.</p>
            ) : (
              modules.map((module) => (
                <div key={module.id} style={styles.moduleCard}>
                  <div style={styles.moduleHeader}>
                    <FiFolder style={styles.folderIcon} />
                    <h3 style={styles.moduleTitle}>{module.title}</h3>
                  </div>
                  <p style={styles.moduleDesc}>{module.description}</p>
                  <div style={styles.lecturesList}>
                    {module.lectures?.map((lecture) => (
                      <div key={lecture.id} style={styles.lectureItem}>
                        <div style={styles.lectureTitleRow}>
                          {completedLectures.includes(lecture.id) ? (
                            <FiCheckCircle style={styles.checkIconCompleted} />
                          ) : (
                            <FiPlay style={styles.playIcon} />
                          )}
                          {isEnrolled ? (
                            <Link to={`/courses/${course.slug}/learn/${lecture.id}`} style={styles.lectureLink}>
                              {lecture.title}
                            </Link>
                          ) : (
                            <span style={styles.lectureTitle}>{lecture.title}</span>
                          )}
                        </div>
                        <span style={styles.lectureDuration}>
                          {Math.round(lecture.duration_seconds / 60)} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div style={styles.sidebar}>
          <div style={styles.infoCard}>
            <h3 style={styles.infoCardTitle}>Requirements</h3>
            <p style={styles.infoCardText}>{course.prerequisites || 'None. Basic computer literacy is sufficient.'}</p>
          </div>
          <div style={styles.infoCard}>
            <h3 style={styles.infoCardTitle}>AI Integrated</h3>
            <p style={styles.infoCardText}>This course includes full integration with our smart AI tutor, auto-generated flashcards, note builders, and progressive hint engines.</p>
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
  },
  emptyState: {
    padding: '4rem',
    textAlign: 'center',
  },
  backLink: {
    marginTop: '1rem',
    display: 'inline-block',
    color: 'var(--color-link)',
  },
  banner: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '2.5rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem',
    marginBottom: '3rem',
    flexWrap: 'wrap-reverse',
  },
  bannerContent: {
    flex: 2,
    minWidth: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  tagRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  categoryBadge: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--accent-primary)',
    border: '1px solid var(--border-primary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    textTransform: 'capitalize',
  },
  difficultyBadge: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: 'var(--fw-bold)',
    lineHeight: '1.2',
  },
  description: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
    lineHeight: '1.5',
  },
  metaRow: {
    display: 'flex',
    gap: '1.5rem',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    flexWrap: 'wrap',
    marginTop: '0.5rem',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  bannerSidebar: {
    flex: 1,
    minWidth: '260px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  thumbnail: {
    width: '100%',
    height: '160px',
    objectFit: 'cover',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '160px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  price: {
    fontSize: '1.75rem',
    fontWeight: 'var(--fw-bold)',
  },
  enrollBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
  },
  enrollBtnDisabled: {
    backgroundColor: 'var(--border-primary)',
    color: 'var(--text-secondary)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    textAlign: 'center',
    width: '100%',
    cursor: 'not-allowed',
  },
  btnDisabled: {
    backgroundColor: 'var(--border-primary)',
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
  },
  roleEnrollNotice: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  roleNoticeBox: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '1.25rem',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  roleNoticeText: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    textTransform: 'capitalize',
    margin: 0,
  },
  roleNoticeSub: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    margin: 0,
  },
  manageBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    textAlign: 'center',
    width: '100%',
    display: 'inline-block',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '3rem',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2.5rem',
  },
  sectionTitle: {
    fontSize: '1.375rem',
    fontWeight: 'var(--fw-semibold)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  fullDesc: {
    lineHeight: '1.6',
    color: 'var(--text-secondary)',
  },
  objectivesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
  },
  objectiveItem: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  checkIcon: {
    color: 'var(--color-success)',
    flexShrink: 0,
    marginTop: '0.25rem',
  },
  modulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  noModules: {
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  moduleCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
  },
  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  folderIcon: {
    color: 'var(--accent-primary)',
  },
  moduleTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
  },
  moduleDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
  },
  lecturesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    borderTop: '1px solid var(--border-primary)',
    paddingTop: '1rem',
  },
  lectureItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
  },
  lectureTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  playIcon: {
    color: 'var(--text-secondary)',
  },
  lectureLink: {
    color: 'var(--color-link)',
    fontWeight: 'var(--fw-medium)',
  },
  lectureTitle: {
    color: 'var(--text-primary)',
  },
  lectureDuration: {
    color: 'var(--text-muted)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  infoCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  infoCardTitle: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
  },
  infoCardText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  viewCertBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--color-success)',
    color: 'var(--color-success)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    marginTop: '0.5rem',
  },
  claimCertBtn: {
    backgroundColor: '#FFA116',
    color: '#1A1A1A',
    border: 'none',
    fontWeight: 'var(--fw-bold)',
    padding: '0.875rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    marginTop: '0.5rem',
    cursor: 'pointer',
  },
  checkIconCompleted: {
    color: 'var(--color-success)',
    flexShrink: 0,
  },
};
