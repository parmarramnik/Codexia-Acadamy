import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiBookOpen, FiCpu, FiMessageSquare } from 'react-icons/fi';

export default function VideoPlayer() {
  const { slug, lectureId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [currentLecture, setCurrentLecture] = useState(null);
  const [completedLectures, setCompletedLectures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load course and syllabus
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const courseRes = await api.get(`/courses/${slug}`);
        setCourse(courseRes.data);

        const [modulesRes, progressRes] = await Promise.all([
          api.get(`/courses/${courseRes.data.id}/modules`),
          api.get(`/courses/${courseRes.data.id}/progress`).catch(() => ({ data: [] }))
        ]);
        setModules(modulesRes.data || []);
        setCompletedLectures(progressRes.data || []);

        // Find current lecture
        let found = null;
        for (const mod of modulesRes.data) {
          const lec = mod.lectures?.find(l => l.id === parseInt(lectureId));
          if (lec) {
            found = lec;
            break;
          }
        }
        setCurrentLecture(found);
      } catch (err) {
        toast.error('Failed to load lecture information');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [slug, lectureId]);

  const handleMarkCompleted = async () => {
    if (!currentLecture) return;
    try {
      await api.patch(`/lectures/${currentLecture.id}/progress`, {
        watch_percentage: 100,
        last_position_seconds: 0
      });
      toast.success('Lecture marked as completed!');
      setCompletedLectures(prev => [...prev, currentLecture.id]);
    } catch (err) {
      toast.error('Failed to update progress');
    }
  };

  // Track progress updates
  useEffect(() => {
    if (!currentLecture || !videoRef.current) return;

    const interval = setInterval(async () => {
      if (!videoRef.current) return;
      const currentTime = Math.floor(videoRef.current.currentTime);
      const duration = Math.floor(videoRef.current.duration) || 1;
      const percentage = Math.min(100, Math.round((currentTime / duration) * 100));

      try {
        await api.patch(`/lectures/${currentLecture.id}/progress`, {
          watch_percentage: percentage,
          last_position_seconds: currentTime,
        });
      } catch (e) {
        // Silent fail
      }
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, [currentLecture]);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading lecture player...</p>
      </div>
    );
  }

  if (!course || !currentLecture) {
    return (
      <div style={styles.emptyState}>
        <h3>Lecture Not Found</h3>
        <Link to={`/courses/${slug}`} style={styles.backLink}>Back to Syllabus</Link>
      </div>
    );
  }

  // Find next and previous lectures in flat list
  const flatLectures = modules.flatMap(m => m.lectures || []);
  const currentIndex = flatLectures.findIndex(l => l.id === currentLecture.id);
  const prevLecture = currentIndex > 0 ? flatLectures[currentIndex - 1] : null;
  const nextLecture = currentIndex < flatLectures.length - 1 ? flatLectures[currentIndex + 1] : null;

  return (
    <div style={styles.container}>
      <div style={styles.playerLayout}>
        {/* Left Video Area */}
        <div style={styles.videoArea}>
          {currentLecture.has_video ? (
            <video
              ref={videoRef}
              src={`/static/videos/lecture_${currentLecture.id}.mp4`}
              controls
              style={styles.videoPlayer}
            />
          ) : (
            <div style={styles.videoPlaceholder}>
              <FiBookOpen size={48} style={styles.placeholderIcon} />
              <p style={styles.placeholderText}>This lecture contains reading materials and AI exercises.</p>
              <div style={styles.actionRow}>
                <Link to="/ai-tutor" style={styles.aiBtn}><FiCpu /> Open AI Tutor</Link>
              </div>
            </div>
          )}

          {/* Navigation Bar */}
          <div style={styles.navBar}>
            <button
              onClick={() => prevLecture && navigate(`/courses/${slug}/learn/${prevLecture.id}`)}
              disabled={!prevLecture}
              style={!prevLecture ? { ...styles.navBtn, ...styles.navBtnDisabled } : styles.navBtn}
            >
              <FiChevronLeft /> Previous
            </button>
            
            {completedLectures.includes(currentLecture.id) ? (
              <button disabled style={styles.completedBtn}>
                Completed ✓
              </button>
            ) : (
              <button onClick={handleMarkCompleted} style={styles.markCompletedBtn}>
                Mark as Completed
              </button>
            )}
            
            <button
              onClick={() => nextLecture && navigate(`/courses/${slug}/learn/${nextLecture.id}`)}
              disabled={!nextLecture}
              style={!nextLecture ? { ...styles.navBtn, ...styles.navBtnDisabled } : styles.navBtn}
            >
              Next <FiChevronRight />
            </button>
          </div>

          {/* Details Tabs */}
          <div style={styles.lectureDetails}>
            <h2 style={styles.detailsTitle}>Description</h2>
            <p style={styles.detailsDesc}>{currentLecture.description || 'No description provided for this lecture.'}</p>
          </div>
        </div>

        {/* Right Sidebar Syllabus */}
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Course Syllabus</h3>
          <div style={styles.syllabusList}>
            {modules.map((module) => (
              <div key={module.id} style={styles.sidebarModule}>
                <span style={styles.sidebarModuleTitle}>{module.title}</span>
                <div style={styles.sidebarLectures}>
                  {module.lectures?.map((lec) => {
                    const isSelected = lec.id === currentLecture.id;
                    const isLecCompleted = completedLectures.includes(lec.id);
                    return (
                      <Link
                        key={lec.id}
                        to={`/courses/${slug}/learn/${lec.id}`}
                        style={isSelected ? { ...styles.sidebarLecLink, ...styles.selectedLec } : styles.sidebarLecLink}
                      >
                        <FiCheckCircle style={isLecCompleted ? styles.checkIconCompleted : styles.checkIcon} />
                        <span style={styles.sidebarLecTitle}>{lec.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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
  playerLayout: {
    display: 'grid',
    gridTemplateColumns: '3fr 1.2fr',
    gap: '2rem',
  },
  videoArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  videoPlayer: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '2rem',
  },
  placeholderIcon: {
    color: 'var(--text-secondary)',
  },
  placeholderText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  actionRow: {
    marginTop: '0.5rem',
  },
  aiBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
  },
  navBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  navBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  lectureTitleDisplay: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-medium)',
  },
  lectureDetails: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    marginTop: '1rem',
  },
  detailsTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '0.75rem',
  },
  detailsDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  sidebar: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    maxHeight: 'calc(16/9 * 50vw)',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  syllabusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  sidebarModule: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sidebarModuleTitle: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--accent-primary)',
  },
  sidebarLectures: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  sidebarLecLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  selectedLec: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
  },
  checkIcon: {
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  checkIconCompleted: {
    color: 'var(--color-success)',
    flexShrink: 0,
  },
  completedBtn: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    color: 'var(--color-success)',
    border: '1px solid rgba(46, 204, 113, 0.3)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    cursor: 'not-allowed',
  },
  markCompletedBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    cursor: 'pointer',
  },
  sidebarLecTitle: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
