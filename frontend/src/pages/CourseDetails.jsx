import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  FiBookOpen, FiClock, FiCheck, FiFolder, FiPlay, FiCheckCircle, 
  FiAward, FiUser, FiChevronDown, FiChevronUp, 
  FiShield, FiLayers, FiChevronRight, FiArrowLeft
} from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';
import PageLoader from '../components/common/PageLoader';

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

  // Accordion state
  const [expandedModules, setExpandedModules] = useState({});
  const [activeTab, setActiveTab] = useState('curriculum');

  const isAdminOrInstructor = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'instructor';

  useEffect(() => {
    async function fetchCourseDetails() {
      setIsLoading(true);
      try {
        const courseRes = await api.get(`/courses/${slug}`);
        setCourse(courseRes.data);

        // Fetch modules
        const modulesRes = await api.get(`/courses/${courseRes.data.id}/modules`);
        const mods = modulesRes.data || [];
        setModules(mods);

        // Expand first two modules by default
        const initExpanded = {};
        mods.forEach((m, idx) => {
          initExpanded[m.id] = idx === 0 || idx === 1;
        });
        setExpandedModules(initExpanded);

        // Check enrollment and progress
        if (isAuthenticated) {
          try {
            const [enrollmentsRes, certsRes, progressRes] = await Promise.all([
              api.get('/courses/enrolled/me'),
              api.get('/certificates').catch(() => ({ data: [] })),
              api.get(`/courses/${courseRes.data.id}/progress`).catch(() => ({ data: [] }))
            ]);

            const enrolledList = enrollmentsRes.data || [];
            const myEnroll = enrolledList.find(e => e.course_id === courseRes.data.id);
            if (myEnroll) {
              setIsEnrolled(true);
              setCompletionPercentage(myEnroll.completion_percentage || 0);
            }

            const certs = certsRes.data || [];
            const existingCert = certs.find(c => c.course_id === courseRes.data.id);
            if (existingCert) {
              setHasCertificate(true);
            }

            if (progressRes.data && Array.isArray(progressRes.data)) {
              setCompletedLectures(progressRes.data);
            }
          } catch (e) {
            console.error('Error fetching user status:', e);
          }
        }
      } catch (err) {
        toast.error('Course not found');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourseDetails();
  }, [slug, isAuthenticated]);

  const toggleModule = (modId) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const expandAllModules = () => {
    const all = {};
    modules.forEach(m => { all[m.id] = true; });
    setExpandedModules(all);
  };

  const collapseAllModules = () => {
    setExpandedModules({});
  };

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in or register to enroll.');
      navigate('/login');
      return;
    }
    setIsEnrolling(true);
    try {
      await api.post(`/courses/${course.id}/enroll`);
      toast.success('Successfully enrolled! Welcome to the course.');
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
      toast.success('Certificate generated successfully! Redirecting...');
      setHasCertificate(true);
      setTimeout(() => navigate('/certificates'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to claim certificate');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!course) {
    return (
      <div style={styles.emptyState}>
        <FiBookOpen size={48} color="var(--text-muted)" />
        <h3 style={styles.emptyTitle}>Course Not Found</h3>
        <p style={styles.emptySub}>The requested course is currently unavailable or has been relocated.</p>
        <Link to="/courses" style={styles.backBtn}>Browse All Courses</Link>
      </div>
    );
  }

  const firstLectureId = modules[0]?.lectures[0]?.id;
  const totalLecturesCount = modules.reduce((acc, m) => acc + (m.lectures?.length || 0), 0);
  const totalDurationSeconds = modules.flatMap(m => m.lectures || []).reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
  const totalDurationHours = (totalDurationSeconds / 3600).toFixed(1);

  return (
    <div style={styles.container}>
      {/* Breadcrumbs Navigation - Clean Back to Courses without Home link */}
      <div style={styles.breadcrumbBar}>
        <Link to="/courses" style={styles.breadcrumbLink}>
          <FiArrowLeft size={14} style={{ marginRight: '6px' }} /> Courses
        </Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>{course.category?.replace('_', ' ').toUpperCase()}</span>
      </div>

      {/* Hero Section */}
      <div style={styles.heroSection}>
        <div style={styles.heroLeft}>
          <div style={styles.badgeRow}>
            <span style={styles.categoryPill}>{course.category?.replace('_', ' ').toUpperCase()}</span>
            <span style={styles.difficultyPill}>{course.difficulty?.toUpperCase()}</span>
            {course.enrollment_count > 0 && (
              <span style={styles.enrollCountBadge}>{course.enrollment_count} Enrolled</span>
            )}
          </div>

          <h1 style={styles.heroTitle}>{course.title}</h1>
          <p style={styles.heroSubtitle}>{course.short_description || course.description}</p>

          {/* Instructor Line */}
          <div style={styles.instructorBar}>
            {course.instructor_avatar_url ? (
              <img src={course.instructor_avatar_url} alt={course.instructor_name} style={styles.instructorAvatar} />
            ) : (
              <div style={styles.instructorAvatarPlaceholder}>
                <FiUser size={18} />
              </div>
            )}
            <div style={styles.instructorInfo}>
              <div style={styles.instructorBy}>
                Instructor: <span style={styles.instructorNameHighlight}>{course.instructor_name || 'Instructor'}</span>
              </div>
              {course.instructor_bio && (
                <div style={styles.instructorRole}>
                  {course.instructor_bio.split('.')[0]}
                </div>
              )}
            </div>
          </div>

          <div style={styles.metaSpecsRow}>
            <span style={styles.specItem}><FiClock size={14} /> {course.duration_hours || totalDurationHours} Hours</span>
            <span style={styles.specItem}><FiBookOpen size={14} /> {totalLecturesCount} Lectures</span>
          </div>
        </div>

        {/* Right Action / Enrollment Card */}
        <div style={styles.heroRight}>
          <div style={styles.enrollmentCard}>
            {/* Thumbnail */}
            <div style={styles.thumbnailWrapper}>
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} style={styles.thumbnailImg} />
              ) : (
                <div style={styles.thumbnailEmpty}>
                  <FiBookOpen size={48} />
                </div>
              )}
            </div>

            <div style={styles.enrollmentCardBody}>
              <div style={styles.pricingBanner}>
                <div>
                  <span style={styles.pricingLabel}>Access Level</span>
                  <div style={styles.freePriceTag}>Free Enrollment</div>
                </div>
                <span style={styles.pricingBadge}>100% Free</span>
              </div>

              {/* Action Buttons */}
              {isEnrolled ? (
                <div style={styles.enrolledActionArea}>
                  <div style={styles.progressContainer}>
                    <div style={styles.progressHeaderRow}>
                      <span style={styles.progressLabel}>Course Progress</span>
                      <span style={styles.progressPercent}>{Math.round(completionPercentage)}%</span>
                    </div>
                    <div style={styles.progressBarTrack}>
                      <div style={{ ...styles.progressBarFill, width: `${Math.min(100, Math.max(0, completionPercentage))}%` }} />
                    </div>
                  </div>

                  {firstLectureId ? (
                    <Link to={`/courses/${course.slug}/learn/${firstLectureId}`} style={styles.resumeLearningBtn}>
                      <FiPlay size={16} /> {completionPercentage > 0 ? `Continue Learning (${Math.round(completionPercentage)}%)` : 'Start Learning'}
                    </Link>
                  ) : null}

                  {hasCertificate ? (
                    <Link to="/certificates" style={styles.viewCertBtn}>
                      <FiAward size={15} /> View Official Certificate
                    </Link>
                  ) : completionPercentage >= 80 ? (
                    <LoadingButton
                      onClick={handleClaimCertificate}
                      loading={isClaiming}
                      loadingText="Issuing Certificate..."
                      style={styles.claimCertBtn}
                    >
                      <FiAward size={15} /> Claim Certificate
                    </LoadingButton>
                  ) : (
                    <div style={styles.certNotice}>
                      <FiAward size={14} color="var(--accent-primary)" />
                      <span>Complete 80% to earn certificate</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={styles.unEnrolledActionArea}>
                  <LoadingButton
                    onClick={handleEnroll}
                    loading={isEnrolling}
                    loadingText="Enrolling..."
                    style={styles.primaryEnrollBtn}
                  >
                    Enroll in Course for Free
                  </LoadingButton>
                </div>
              )}

              {/* Course Includes Feature Highlights */}
              <div style={styles.courseIncludesList}>
                <div style={styles.courseIncludeItem}>
                  <FiCheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <span>Full syllabus & video lectures</span>
                </div>
                <div style={styles.courseIncludeItem}>
                  <FiCheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <span>Interactive quizzes & labs</span>
                </div>
                <div style={styles.courseIncludeItem}>
                  <FiCheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <span>Official completion certificate</span>
                </div>
                <div style={styles.courseIncludeItem}>
                  <FiCheckCircle size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <span>Lifetime self-paced access</span>
                </div>
              </div>

              {/* Instructor / Admin Shortcuts */}
              {isAdminOrInstructor && (
                <div style={styles.instructorAdminPanel}>
                  <div style={styles.roleHeaderSmall}>
                    <FiShield size={13} /> {user.role?.toUpperCase()}
                  </div>
                  <Link to="/instructor" style={styles.adminStudioBtn}>
                    <FiLayers size={14} /> Open Course Studio
                  </Link>
                </div>
              )}

              {/* Real Course Inclusions */}
              <div style={styles.includesBox}>
                <div style={styles.includesTitle}>Course details:</div>
                <div style={styles.includesItem}><FiPlay size={14} color="var(--accent-primary)" /> {totalLecturesCount} video lectures</div>
                <div style={styles.includesItem}><FiBookOpen size={14} color="var(--accent-primary)" /> {modules.length} structured modules</div>
                <div style={styles.includesItem}><FiAward size={14} color="var(--accent-primary)" /> Completion Certificate</div>
                <div style={styles.includesItem}><FiClock size={14} color="var(--accent-primary)" /> Self-paced access</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={styles.stickyTabsBar}>
        <button
          onClick={() => setActiveTab('curriculum')}
          style={activeTab === 'curriculum' ? { ...styles.subTabBtn, ...styles.activeSubTab } : styles.subTabBtn}
        >
          Curriculum & Syllabus ({totalLecturesCount})
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          style={activeTab === 'overview' ? { ...styles.subTabBtn, ...styles.activeSubTab } : styles.subTabBtn}
        >
          Overview & Objectives
        </button>
        <button
          onClick={() => setActiveTab('instructor')}
          style={activeTab === 'instructor' ? { ...styles.subTabBtn, ...styles.activeSubTab } : styles.subTabBtn}
        >
          Instructor
        </button>
      </div>

      {/* Main Content Layout */}
      <div style={styles.mainLayout}>
        <div style={styles.leftContent}>
          {/* TAB: Curriculum */}
          {activeTab === 'curriculum' && (
            <div style={styles.tabSection}>
              <div style={styles.curriculumTopBar}>
                <div>
                  <h2 style={styles.sectionHeading}>Curriculum & Syllabus</h2>
                  <p style={styles.sectionSubhead}>
                    {modules.length} Modules • {totalLecturesCount} Lectures • {totalDurationHours} Hours Total Video Length
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={expandAllModules} style={styles.expandToggleBtn}>Expand All</button>
                  <button onClick={collapseAllModules} style={styles.expandToggleBtn}>Collapse All</button>
                </div>
              </div>

              <div style={styles.curriculumModulesList}>
                {modules.length === 0 ? (
                  <p style={styles.emptySyllabus}>No syllabus modules added yet.</p>
                ) : (
                  modules.map((module, mIdx) => {
                    const isExpanded = !!expandedModules[module.id];
                    const moduleLectures = module.lectures || [];
                    const moduleDurationSec = moduleLectures.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
                    const moduleMin = Math.round(moduleDurationSec / 60);

                    return (
                      <div key={module.id} style={styles.moduleCard}>
                        <div onClick={() => toggleModule(module.id)} style={styles.moduleCardHeader}>
                          <div style={styles.moduleHeaderLeft}>
                            {isExpanded ? (
                              <FiChevronUp size={18} style={styles.chevronIcon} />
                            ) : (
                              <FiChevronDown size={18} style={styles.chevronIcon} />
                            )}
                            <span style={styles.moduleOrderTag}>Module {mIdx + 1}</span>
                            <span style={styles.moduleTitleText}>{module.title}</span>
                          </div>
                          <div style={styles.moduleHeaderRight}>
                            <span style={styles.moduleMetaBadge}>{moduleLectures.length} lectures</span>
                            <span style={styles.moduleMetaBadge}>{moduleMin} min</span>
                          </div>
                        </div>

                        {module.description && isExpanded && (
                          <div style={styles.moduleDescBlock}>
                            <p style={styles.moduleDescText}>{module.description}</p>
                          </div>
                        )}

                        {isExpanded && (
                          <div style={styles.lecturesList}>
                            {moduleLectures.map((lecture) => {
                              const isLectureDone = completedLectures.includes(lecture.id);
                              const lectureMin = Math.round((lecture.duration_seconds || 0) / 60);

                              return (
                                <div key={lecture.id} style={styles.lectureRow}>
                                  <div style={styles.lectureRowLeft}>
                                    {isLectureDone ? (
                                      <FiCheckCircle size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                                    ) : (
                                      <FiPlay size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={styles.lectureRowTitle}>
                                        {lecture.title}
                                      </span>
                                      {lecture.description && (
                                        <span style={styles.lectureRowDesc}>{lecture.description}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={styles.lectureRowRight}>
                                    <span style={styles.lectureDurationText}>{lectureMin} min</span>
                                    {isEnrolled ? (
                                      <Link to={`/courses/${course.slug}/learn/${lecture.id}`} style={styles.startLectureBtn}>
                                        Start <FiChevronRight size={13} />
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: Overview & Objectives */}
          {activeTab === 'overview' && (
            <div style={styles.tabSection}>
              {/* Learning Objectives */}
              {course.learning_objectives && (
                <div style={styles.whatYouLearnBox}>
                  <h2 style={styles.boxHeading}>What You'll Learn</h2>
                  <div style={styles.objectivesGrid}>
                    {course.learning_objectives.split('\n').filter(Boolean).map((obj, i) => (
                      <div key={i} style={styles.objectiveRow}>
                        <div style={styles.greenCheckCircle}>
                          <FiCheck size={14} color="#FFF" />
                        </div>
                        <span style={styles.objectiveText}>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Course Description */}
              <div style={styles.descriptionBox}>
                <h2 style={styles.sectionHeading}>Course Description</h2>
                <div style={styles.descriptionParagraphs}>
                  <p style={styles.descText}>{course.description}</p>
                </div>
              </div>

              {/* Prerequisites */}
              {course.prerequisites && (
                <div style={styles.requirementsBox}>
                  <h3 style={styles.reqTitle}>Requirements & Prerequisites</h3>
                  <p style={styles.reqText}>{course.prerequisites}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: Instructor Profile */}
          {activeTab === 'instructor' && (
            <div style={styles.tabSection}>
              <div style={styles.instructorProfileCard}>
                <div style={styles.instructorProfileHeader}>
                  {course.instructor_avatar_url ? (
                    <img src={course.instructor_avatar_url} alt={course.instructor_name} style={styles.instructorLargeAvatar} />
                  ) : (
                    <div style={styles.instructorLargeAvatarPlaceholder}>
                      <FiUser size={36} />
                    </div>
                  )}
                  <div>
                    <h2 style={styles.instructorProfileName}>{course.instructor_name || 'Instructor'}</h2>
                  </div>
                </div>

                {course.instructor_bio && (
                  <div style={styles.instructorBioBody}>
                    <p style={styles.instructorBioText}>{course.instructor_bio}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '100%',
    margin: '0',
    padding: '0 0 3rem 0',
    color: 'var(--text-primary)',
  },
  breadcrumbBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
  },
  breadcrumbLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  breadcrumbSep: {
    color: 'var(--border-primary)',
  },
  breadcrumbCurrent: {
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 380px)',
    gap: '2rem',
    alignItems: 'flex-start',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    marginBottom: '1.75rem',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  categoryPill: {
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-bold)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: 'var(--accent-primary)',
    letterSpacing: '0.5px',
  },
  difficultyPill: {
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-semibold)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
  },
  enrollCountBadge: {
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-semibold)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--color-success)',
  },
  heroTitle: {
    fontSize: '2.3rem',
    fontWeight: '800',
    lineHeight: '1.2',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
    letterSpacing: '-0.5px',
  },
  heroSubtitle: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: 'var(--text-secondary)',
    marginBottom: '1.5rem',
  },
  instructorBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.85rem 1.15rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-secondary)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.5rem',
  },
  instructorAvatar: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--accent-primary)',
  },
  instructorAvatarPlaceholder: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
  },
  instructorInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  instructorBy: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  instructorNameHighlight: {
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
  },
  instructorRole: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  metaSpecsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    flexWrap: 'wrap',
  },
  specItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  heroRight: {
    position: 'sticky',
    top: '5rem',
  },
  enrollmentCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: 'var(--bg-tertiary)',
    overflow: 'hidden',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbnailEmpty: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
  },
  enrollmentCardBody: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  pricingBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.85rem',
    borderBottom: '1px solid var(--border-secondary)',
  },
  pricingLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    fontWeight: 'var(--fw-semibold)',
  },
  freePriceTag: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--color-success)',
    letterSpacing: '-0.02em',
    marginTop: '2px',
  },
  pricingBadge: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: 'var(--color-success)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  courseIncludesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    paddingTop: '0.85rem',
    borderTop: '1px solid var(--border-secondary)',
    marginTop: '0.5rem',
  },
  courseIncludeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  enrolledActionArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  progressContainer: {
    padding: '0.85rem',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-md)',
  },
  progressHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '6px',
  },
  progressLabel: {
    color: 'var(--text-secondary)',
  },
  progressPercent: {
    color: 'var(--color-success)',
  },
  progressBarTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: 'var(--border-secondary)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'var(--color-success)',
    borderRadius: 'var(--radius-full)',
    transition: 'width 0.4s ease',
  },
  resumeLearningBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.85rem',
    backgroundColor: 'var(--accent-primary)',
    color: '#FFF',
    textDecoration: 'none',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-bold)',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
  },
  viewCertBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.85rem',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#F59E0B',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    textDecoration: 'none',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-bold)',
    fontSize: '0.95rem',
    textAlign: 'center',
  },
  claimCertBtn: {
    width: '100%',
    padding: '0.85rem',
    backgroundColor: 'var(--color-success)',
    color: '#FFF',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--fw-bold)',
    fontSize: '0.95rem',
    border: 'none',
    cursor: 'pointer',
  },
  certNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  unEnrolledActionArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  primaryEnrollBtn: {
    width: '100%',
    padding: '1rem',
    backgroundColor: 'var(--accent-primary)',
    color: '#FFF',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    fontWeight: '800',
    cursor: 'pointer',
    letterSpacing: '0.3px',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
  },
  instructorAdminPanel: {
    backgroundColor: 'var(--bg-tertiary)',
    padding: '0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--border-primary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  roleHeaderSmall: {
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  adminStudioBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.6rem',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-semibold)',
    textDecoration: 'none',
    border: '1px solid var(--border-secondary)',
  },
  includesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  includesTitle: {
    fontSize: '0.8rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  includesItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
  },
  stickyTabsBar: {
    display: 'flex',
    gap: '1rem',
    borderBottom: '2px solid var(--border-primary)',
    marginBottom: '2rem',
  },
  subTabBtn: {
    padding: '0.85rem 1.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)',
    cursor: 'pointer',
    marginBottom: '-2px',
    transition: 'all 0.2s',
  },
  activeSubTab: {
    color: 'var(--accent-primary)',
    borderBottom: '2px solid var(--accent-primary)',
  },
  mainLayout: {
    display: 'block',
  },
  leftContent: {
    width: '100%',
  },
  tabSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  curriculumTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-secondary)',
  },
  sectionHeading: {
    fontSize: '1.4rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
  },
  sectionSubhead: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  expandToggleBtn: {
    padding: '6px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-secondary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: 'var(--fw-medium)',
  },
  curriculumModulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  emptySyllabus: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
  },
  moduleCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  moduleCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-secondary)',
    userSelect: 'none',
  },
  moduleHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  chevronIcon: {
    color: 'var(--text-muted)',
  },
  moduleOrderTag: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
    textTransform: 'uppercase',
  },
  moduleTitleText: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
  },
  moduleHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  moduleMetaBadge: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-primary)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-secondary)',
  },
  moduleDescBlock: {
    padding: '0.75rem 1.25rem',
    backgroundColor: 'var(--bg-primary)',
    borderBottom: '1px solid var(--border-secondary)',
  },
  moduleDescText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: 0,
  },
  lecturesList: {
    display: 'flex',
    flexDirection: 'column',
  },
  lectureRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.9rem 1.25rem',
    borderTop: '1px solid var(--border-secondary)',
    backgroundColor: 'var(--bg-card)',
    gap: '1rem',
  },
  lectureRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
  },
  lectureRowTitle: {
    fontSize: '0.9rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-primary)',
  },
  lectureRowDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  lectureRowRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  lectureDurationText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  startLectureBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '5px 12px',
    backgroundColor: 'var(--accent-primary)',
    color: '#FFF',
    textDecoration: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: 'var(--fw-semibold)',
  },
  whatYouLearnBox: {
    padding: '1.75rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
  },
  boxHeading: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
  },
  objectivesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
  },
  objectiveRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  greenCheckCircle: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-success)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  objectiveText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  descriptionBox: {
    padding: '1.75rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
  },
  descriptionParagraphs: {
    marginTop: '1rem',
  },
  descText: {
    fontSize: '0.95rem',
    lineHeight: '1.7',
    color: 'var(--text-secondary)',
    margin: 0,
    whiteSpace: 'pre-line',
  },
  requirementsBox: {
    padding: '1.5rem 1.75rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
  },
  reqTitle: {
    fontSize: '1.1rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    marginBottom: '0.65rem',
  },
  reqText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
    whiteSpace: 'pre-line',
  },
  instructorProfileCard: {
    padding: '2rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
  },
  instructorProfileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    marginBottom: '1.25rem',
  },
  instructorLargeAvatar: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid var(--accent-primary)',
  },
  instructorLargeAvatarPlaceholder: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
  },
  instructorProfileName: {
    fontSize: '1.35rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    margin: 0,
  },
  instructorBioBody: {
    borderTop: '1px solid var(--border-secondary)',
    paddingTop: '1.25rem',
  },
  instructorBioText: {
    fontSize: '0.95rem',
    lineHeight: '1.7',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  emptyState: {
    textAlign: 'center',
    padding: '5rem 2rem',
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-primary)',
    marginTop: '1rem',
  },
  emptySub: {
    color: 'var(--text-muted)',
    marginTop: '0.5rem',
    marginBottom: '1.5rem',
  },
  backBtn: {
    display: 'inline-block',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--accent-primary)',
    color: '#FFF',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontWeight: 'var(--fw-semibold)',
  },
};
