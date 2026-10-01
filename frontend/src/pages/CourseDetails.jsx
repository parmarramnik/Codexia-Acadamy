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
import EmptyState from '../components/common/EmptyState';
import CourseCover from '../components/common/CourseCover';
import '../styles/pages/course-details.css';

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
      <EmptyState
        icon={FiBookOpen}
        title="Course not found"
        description="The requested course is currently unavailable or has been relocated."
        action={<Link to="/courses" className="btn btn-primary">Browse All Courses</Link>}
      />
    );
  }

  const firstLectureId = modules[0]?.lectures[0]?.id;
  const totalLecturesCount = modules.reduce((acc, m) => acc + (m.lectures?.length || 0), 0);
  const totalDurationSeconds = modules.flatMap(m => m.lectures || []).reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
  const totalDurationHours = (totalDurationSeconds / 3600).toFixed(1);

  return (
    <div className="page cd-page">
      {/* Breadcrumbs Navigation - Clean Back to Courses without Home link */}
      <div style={styles.breadcrumbBar}>
        <Link to="/courses" style={styles.breadcrumbLink}>
          <FiArrowLeft size={14} style={{ marginRight: '6px' }} /> Courses
        </Link>
        <span style={styles.breadcrumbSep}>/</span>
        <span style={styles.breadcrumbCurrent}>{course.category?.replace('_', ' ')}</span>
      </div>

      {/* Hero Section */}
      <div className="cd-hero" style={styles.heroSection}>
        <div className="cd-hero-left" style={styles.heroLeft}>
          <div style={styles.badgeRow}>
            <span className="badge badge-primary">{course.category?.replace('_', ' ')}</span>
            <span className="badge badge-neutral">{course.difficulty}</span>
            {course.enrollment_count > 0 && (
              <span className="badge badge-success badge-dot">{course.enrollment_count} Enrolled</span>
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

          <div className="cd-tabs-wrap" style={{ marginTop: '2.5rem' }}>
          {/* Navigation Sub-Tabs */}
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'curriculum'}
              onClick={() => setActiveTab('curriculum')}
              className={`tab ${activeTab === 'curriculum' ? 'active' : ''}`}
            >
              Curriculum & Syllabus ({totalLecturesCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            >
              Overview & Objectives
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'instructor'}
              onClick={() => setActiveTab('instructor')}
              className={`tab ${activeTab === 'instructor' ? 'active' : ''}`}
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
                      <button type="button" onClick={expandAllModules} className="btn btn-ghost btn-sm">Expand All</button>
                      <button type="button" onClick={collapseAllModules} className="btn btn-ghost btn-sm">Collapse All</button>
                    </div>
                  </div>

                  <div style={styles.curriculumModulesList}>
                    {modules.length === 0 ? (
                      <EmptyState icon={FiFolder} title="No modules yet" description="No syllabus modules added yet. Check back soon." />
                    ) : (
                      modules.map((module, mIdx) => {
                        const isExpanded = !!expandedModules[module.id];
                        const moduleLectures = module.lectures || [];
                        const moduleDurationSec = moduleLectures.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
                        const moduleMin = Math.round(moduleDurationSec / 60);

                        return (
                          <div key={module.id} style={styles.moduleCard}>
                            <div
                              onClick={() => toggleModule(module.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleModule(module.id); } }}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              className="cd-module-header"
                              style={styles.moduleCardHeader}
                            >
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
                                    <div key={lecture.id} className="cd-lecture-row" style={styles.lectureRow}>
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
                                          <Link to={`/courses/${course.slug}/learn/${lecture.id}`} className="btn btn-secondary btn-sm">
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
                              <FiCheck size={12} />
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
        </div>

        {/* Right Action / Enrollment Card */}
        <div className="cd-hero-right" style={styles.heroRight}>
          <div style={styles.enrollmentCard}>
            {/* Thumbnail */}
            <div style={styles.thumbnailWrapper}>
              <CourseCover src={course.thumbnail_url} title={course.title} category={course.category} height="100%" />
            </div>

            <div style={styles.enrollmentCardBody}>
              <div style={styles.pricingBanner}>
                <div>
                  <span style={styles.pricingLabel}>Access Level</span>
                  <div style={styles.freePriceTag}>Free Enrollment</div>
                </div>
                <span className="badge badge-success">100% Free</span>
              </div>

              {/* Action Buttons */}
              {isEnrolled ? (
                <div style={styles.enrolledActionArea}>
                  <div style={styles.progressContainer}>
                    <div style={styles.progressHeaderRow}>
                      <span style={styles.progressLabel}>Course Progress</span>
                      <span style={styles.progressPercent}>{Math.round(completionPercentage)}%</span>
                    </div>
                    <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(completionPercentage)} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
                      <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.max(0, completionPercentage))}%`, backgroundColor: 'var(--success)' }} />
                    </div>
                  </div>

                  {firstLectureId ? (
                    <Link to={`/courses/${course.slug}/learn/${firstLectureId}`} className="btn btn-primary btn-lg btn-block">
                      <FiPlay size={16} /> {completionPercentage > 0 ? `Continue Learning (${Math.round(completionPercentage)}%)` : 'Start Learning'}
                    </Link>
                  ) : null}

                  {hasCertificate ? (
                    <Link to="/certificates" className="btn btn-secondary btn-block">
                      <FiAward size={15} /> View Official Certificate
                    </Link>
                  ) : completionPercentage >= 80 ? (
                    <LoadingButton
                      onClick={handleClaimCertificate}
                      loading={isClaiming}
                      loadingText="Issuing Certificate..."
                      className="btn btn-success btn-block"
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
                    className="btn btn-primary btn-lg btn-block"
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
                  <Link to="/instructor" className="btn btn-secondary btn-sm">
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

    </div>
  );
}

const styles = {
  breadcrumbBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
  },
  breadcrumbLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  breadcrumbSep: {
    color: 'var(--border-primary)',
  },
  breadcrumbCurrent: {
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    textTransform: 'capitalize',
  },
  heroSection: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 360px',
    gap: '3rem',
    alignItems: 'flex-start',
    padding: '0.5rem 0 0',
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
  heroTitle: {
    fontSize: 'clamp(1.75rem, 3.2vw, 2.5rem)',
    fontWeight: 'var(--fw-semibold)',
    lineHeight: '1.15',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
    letterSpacing: '-0.035em',
  },
  heroSubtitle: {
    fontSize: '1.0625rem',
    lineHeight: '1.65',
    color: 'var(--text-secondary)',
    marginBottom: '1.75rem',
    maxWidth: '680px',
  },
  instructorBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    marginBottom: '1.5rem',
  },
  instructorAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  instructorAvatarPlaceholder: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--surface-hover)',
    border: '1px solid var(--border)',
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
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: 'var(--bg-tertiary)',
    overflow: 'hidden',
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
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 'var(--fw-medium)',
  },
  freePriceTag: {
    fontSize: '1.375rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginTop: '2px',
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
    padding: '0.85rem 1rem',
    backgroundColor: 'var(--surface-sunken)',
    border: '1px solid var(--border-subtle)',
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
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
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
  instructorAdminPanel: {
    padding: '0.85rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  includesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  includesTitle: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-muted)',
    marginBottom: '2px',
  },
  includesItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
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
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  sectionHeading: {
    fontSize: 'var(--fs-xl)',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
    marginBottom: '0.35rem',
  },
  sectionSubhead: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  curriculumModulesList: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-card)',
  },
  moduleCard: {
    borderBottom: '1px solid var(--border-primary)',
  },
  moduleCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    cursor: 'pointer',
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
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
  },
  moduleTitleText: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)',
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
    whiteSpace: 'nowrap',
  },
  moduleDescBlock: {
    padding: '0 1.25rem 0.85rem 3.35rem',
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
    padding: '0.75rem 1.25rem 0.75rem 3.35rem',
    borderTop: '1px solid var(--border-secondary)',
    backgroundColor: 'var(--bg-tertiary)',
    gap: '1rem',
  },
  lectureRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
  },
  lectureRowTitle: {
    fontSize: '0.875rem',
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
  whatYouLearnBox: {
    padding: '1.75rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
  },
  boxHeading: {
    fontSize: 'var(--fs-lg)',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
  },
  objectivesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
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
    backgroundColor: 'var(--color-success-bg)',
    color: 'var(--color-success)',
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
    fontSize: 'var(--fs-xl)',
    fontWeight: 'var(--fw-semibold)',
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
};
