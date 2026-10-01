import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  FiChevronLeft, FiChevronRight, FiCheckCircle, FiBookOpen, FiCpu, 
  FiLink, FiTrash2, FiEdit2, FiShield, FiX, FiCheck, FiVideo, FiPlay 
} from 'react-icons/fi';
import PageLoader from '../components/common/PageLoader';

export default function VideoPlayer() {
  const { slug, lectureId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [currentLecture, setCurrentLecture] = useState(null);
  const [completedLectures, setCompletedLectures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Higher-role video editing states
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [isUpdatingVideo, setIsUpdatingVideo] = useState(false);

  const isAdminOrInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'super_admin';

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
        if (found) {
          setNewVideoUrl(found.video_url || '');
        }
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

  // Track progress updates for HTML5 videos
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
    }, 10000);

    return () => clearInterval(interval);
  }, [currentLecture]);

  // Higher role video handlers
  const handleSaveVideoUrl = async (e) => {
    e.preventDefault();
    if (!currentLecture) return;
    setIsUpdatingVideo(true);
    try {
      const cleanUrl = newVideoUrl.trim();
      await api.post(`/lectures/${currentLecture.id}/video-url`, {
        video_url: cleanUrl
      });
      toast.success('Lecture video updated successfully!');
      setCurrentLecture(prev => ({ ...prev, video_url: cleanUrl, has_video: Boolean(cleanUrl) }));
      setShowVideoModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update video link');
    } finally {
      setIsUpdatingVideo(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!currentLecture) return;
    const confirmRemove = window.confirm(`Are you sure you want to remove the video from "${currentLecture.title}"?`);
    if (!confirmRemove) return;

    try {
      await api.delete(`/lectures/${currentLecture.id}/video`);
      toast.success('Video removed from lecture');
      setCurrentLecture(prev => ({ ...prev, video_url: null, has_video: false }));
      setNewVideoUrl('');
      setShowVideoModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove video');
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (!course || !currentLecture) {
    return (
      <div style={styles.emptyState}>
        <FiBookOpen size={48} color="var(--text-muted)" />
        <h3>Lecture Not Found</h3>
        <p style={{ color: 'var(--text-secondary)' }}>The requested lecture is unavailable or not enrolled.</p>
        <Link to={`/courses/${slug}`} style={styles.backBtn}>Back to Syllabus</Link>
      </div>
    );
  }

  // Flatten lectures for previous/next navigation
  const flatLectures = modules.flatMap(m => m.lectures || []);
  const currentIndex = flatLectures.findIndex(l => l.id === currentLecture.id);
  const prevLecture = currentIndex > 0 ? flatLectures[currentIndex - 1] : null;
  const nextLecture = currentIndex < flatLectures.length - 1 ? flatLectures[currentIndex + 1] : null;

  const totalLecturesCount = flatLectures.length;
  const completedCount = completedLectures.length;
  const progressPercent = totalLecturesCount > 0 ? Math.round((completedCount / totalLecturesCount) * 100) : 0;

  // Resolve video stream type and embed link
  const rawVideo = currentLecture.video_url || '';
  
  const resolveVideoProvider = (url) => {
    if (!url || !url.trim()) return { type: 'none', provider: 'None', embedUrl: '' };

    const clean = url.trim();

    // 1. Google Drive
    if (clean.includes('drive.google.com')) {
      let fileId = null;
      const match1 = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match1 && match1[1]) {
        fileId = match1[1];
      } else {
        const match2 = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match2 && match2[1]) fileId = match2[1];
      }
      if (fileId) {
        return {
          type: 'iframe',
          provider: 'Google Drive',
          embedUrl: `https://drive.google.com/file/d/${fileId}/preview`
        };
      }
    }

    // 2. YouTube
    if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
      let videoId = '';
      if (clean.includes('watch?v=')) {
        videoId = clean.split('watch?v=')[1]?.split('&')[0];
      } else if (clean.includes('youtu.be/')) {
        videoId = clean.split('youtu.be/')[1]?.split('?')[0];
      } else if (clean.includes('embed/')) {
        videoId = clean.split('embed/')[1]?.split('?')[0];
      } else if (clean.includes('shorts/')) {
        videoId = clean.split('shorts/')[1]?.split('?')[0];
      }
      if (videoId) {
        return {
          type: 'iframe',
          provider: 'YouTube',
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
        };
      }
    }

    // 3. Vimeo
    if (clean.includes('vimeo.com')) {
      const match = clean.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
      if (match && match[1]) {
        return {
          type: 'iframe',
          provider: 'Vimeo',
          embedUrl: `https://player.vimeo.com/video/${match[1]}?autoplay=1`
        };
      }
    }

    // 4. Loom
    if (clean.includes('loom.com')) {
      const match = clean.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        return {
          type: 'iframe',
          provider: 'Loom',
          embedUrl: `https://www.loom.com/embed/${match[1]}?autoplay=1`
        };
      }
    }

    // 5. Direct Stream (MP4, WebM, Cloudflare R2, AWS S3, Google Cloud CDN)
    return {
      type: 'direct',
      provider: 'Direct Cloud Video (MP4)',
      directUrl: clean
    };
  };

  const videoMeta = resolveVideoProvider(rawVideo);

  return (
    <div style={styles.container}>
      {/* Top Workspace Navigation Bar */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to={`/courses/${slug}`} style={styles.backLink}>
            <FiChevronLeft size={16} />
            <span>Course Syllabus</span>
          </Link>
          <div style={styles.divider} />
          <div>
            <span style={styles.courseHeaderTitle}>{course.title}</span>
            <span style={styles.lectureHeaderTitle}> • {currentLecture.title}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={styles.headerProgressWrapper}>
            <div style={styles.headerProgressTrack}>
              <div style={{ ...styles.headerProgressFill, width: `${progressPercent}%` }} />
            </div>
            <span style={styles.headerProgressText}>{progressPercent}% Complete</span>
          </div>

          {progressPercent >= 80 && (
            <Link to="/certificates" style={styles.certBadgeBtn}>
              🏆 Certificate Unlocked
            </Link>
          )}
        </div>
      </div>

      <div className="r-stack" style={styles.playerLayout}>
        {/* Left Video Area */}
        <div style={styles.videoArea}>
          {videoMeta.type === 'iframe' ? (
            <div style={styles.iframeContainer}>
              <iframe
                src={videoMeta.embedUrl}
                title={currentLecture.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                style={styles.iframePlayer}
              />
            </div>
          ) : videoMeta.type === 'direct' ? (
            <video
              ref={videoRef}
              key={currentLecture.id}
              src={videoMeta.directUrl}
              controls
              autoPlay
              playsInline
              style={styles.videoPlayer}
            />
          ) : (
            <div style={styles.videoPlaceholder}>
              <FiBookOpen size={48} style={styles.placeholderIcon} />
              <p style={styles.placeholderText}>This lecture currently has reading materials and interactive labs.</p>
              {isAdminOrInstructor && (
                <button onClick={() => setShowVideoModal(true)} style={styles.attachVideoPromptBtn}>
                  <FiVideo size={16} /> Attach Video Link / Upload
                </button>
              )}
            </div>
          )}

          {/* Higher-Role Video Controls Toolbar */}
          {isAdminOrInstructor && (
            <div style={styles.instructorVideoBar}>
              <div style={styles.instructorBarLeft}>
                <FiShield size={14} color="var(--accent-primary)" />
                <span style={styles.providerTag}>Provider: <strong>{videoMeta.provider}</strong></span>
              </div>
              <div style={styles.instructorBarActions}>
                <button onClick={() => setShowVideoModal(true)} style={styles.changeVideoBtn}>
                  <FiEdit2 size={13} /> Change Video Link
                </button>
                {currentLecture.video_url && (
                  <button onClick={handleRemoveVideo} style={styles.removeVideoBtn}>
                    <FiTrash2 size={13} /> Remove Video
                  </button>
                )}
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
              <FiChevronLeft /> Previous Lecture
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
              Next Lecture <FiChevronRight />
            </button>
          </div>

          {/* Lecture Notes & Objectives */}
          <div style={styles.lectureDetails}>
            <h2 style={styles.detailsTitle}>Lecture Notes & Learning Summary</h2>
            <p style={styles.detailsDesc}>{currentLecture.description || 'Core concepts, hands-on architectures, and live coding exercises for this topic.'}</p>
          </div>
        </div>

        {/* Right Sidebar Syllabus */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeaderRow}>
            <h3 style={styles.sidebarTitle}>Course Syllabus</h3>
            <span style={styles.sidebarBadge}>{completedCount}/{totalLecturesCount} Completed</span>
          </div>
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
                        <span style={styles.lecTimeTag}>{Math.round((lec.duration_seconds || 600) / 60)}m</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Change / Attach Video Modal */}
      {showVideoModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiVideo size={18} color="var(--accent-primary)" />
                <h3 style={styles.modalTitle}>Change Lecture Video</h3>
              </div>
              <button onClick={() => setShowVideoModal(false)} style={styles.modalCloseBtn}>
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVideoUrl} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Video URL (Google Drive, YouTube, Vimeo, or Direct MP4):</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/... or https://youtube.com/..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              {/* Helpful Link Guide */}
              <div style={styles.guideBox}>
                <div style={styles.guideTitle}>Supported Link Types & Examples:</div>
                <ul style={styles.guideList}>
                  <li>
                    <strong>Google Drive:</strong> <code>https://drive.google.com/file/d/FILE_ID/view?usp=sharing</code><br />
                    <small>Make sure Drive permission is set to <em>"Anyone with the link can view"</em>.</small>
                  </li>
                  <li>
                    <strong>YouTube:</strong> <code>https://www.youtube.com/watch?v=VIDEO_ID</code> or <code>https://youtu.be/ID</code>
                  </li>
                  <li>
                    <strong>Direct Cloud CDN / Storage:</strong> <code>https://your-bucket.storage.googleapis.com/video.mp4</code> or AWS S3 / Cloudflare link.
                  </li>
                </ul>
              </div>

              <div style={styles.modalBtnRow}>
                <button type="submit" disabled={isUpdatingVideo} style={styles.saveBtn}>
                  <FiCheck /> {isUpdatingVideo ? 'Saving...' : 'Save Video Link'}
                </button>
                {currentLecture.video_url && (
                  <button type="button" onClick={handleRemoveVideo} style={styles.deleteVideoBtn}>
                    <FiTrash2 /> Remove Video
                  </button>
                )}
                <button type="button" onClick={() => setShowVideoModal(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '0 0 2rem 0',
    maxWidth: '100%',
    margin: '0',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    gap: '1rem',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border-primary)',
    borderTopColor: 'var(--accent-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.65rem 1rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '0.85rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    textDecoration: 'none',
    fontWeight: 'var(--fw-medium)',
  },
  divider: {
    width: '1px',
    height: '18px',
    backgroundColor: 'var(--border-primary)',
  },
  courseHeaderTitle: {
    fontSize: '0.9rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
  },
  lectureHeaderTitle: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  headerProgressWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerProgressTrack: {
    width: '120px',
    height: '6px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  headerProgressFill: {
    height: '100%',
    backgroundColor: 'var(--color-success)',
    transition: 'width 0.3s ease',
  },
  headerProgressText: {
    fontSize: '0.8rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--color-success)',
  },
  certBadgeBtn: {
    backgroundColor: 'var(--color-warning-bg)',
    border: '1px solid var(--color-warning)',
    color: 'var(--color-warning)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.35rem 0.75rem',
    borderRadius: 'var(--radius-full)',
    textDecoration: 'none',
  },
  playerLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 350px',
    gap: '1rem',
    alignItems: 'flex-start',
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
    outline: 'none',
    boxShadow: 'var(--shadow-xl)',
  },
  iframeContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-xl)',
  },
  iframePlayer: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
    gap: '1rem',
    textAlign: 'center',
  },
  placeholderIcon: {
    color: 'var(--accent-primary)',
  },
  placeholderText: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    maxWidth: '450px',
    margin: 0,
  },
  attachVideoPromptBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    padding: '0.65rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-medium)',
    border: 'none',
    cursor: 'pointer',
  },
  instructorVideoBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.6rem 1rem',
    fontSize: '0.8rem',
  },
  instructorBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  providerTag: {
    color: 'var(--text-secondary)',
  },
  instructorBarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  changeVideoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontSize: '0.75rem',
    padding: '0.35rem 0.65rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  removeVideoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
    color: 'var(--color-error)',
    fontSize: '0.75rem',
    padding: '0.35rem 0.65rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.2rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-medium)',
    cursor: 'pointer',
  },
  navBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  markCompletedBtn: {
    backgroundColor: 'var(--success-solid)',
    color: '#FFFFFF',
    padding: '0.6rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-semibold)',
    cursor: 'pointer',
  },
  completedBtn: {
    backgroundColor: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success)',
    padding: '0.6rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-semibold)',
    cursor: 'default',
  },
  lectureDetails: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
  },
  detailsTitle: {
    fontSize: '1.1rem',
    fontWeight: 'var(--fw-semibold)',
    margin: '0 0 0.5rem 0',
  },
  detailsDesc: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  sidebar: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: 'calc(100vh - 140px)',
    overflowY: 'auto',
  },
  sidebarHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  sidebarTitle: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)',
    margin: 0,
  },
  sidebarBadge: {
    fontSize: '0.75rem',
    color: 'var(--accent-primary)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid var(--border-primary)',
  },
  syllabusList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  sidebarModule: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  sidebarModuleTitle: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sidebarLectures: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  sidebarLecLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    transition: 'background-color 0.15s ease',
  },
  selectedLec: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)',
  },
  sidebarLecTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lecTimeTag: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  checkIcon: {
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  checkIconCompleted: {
    color: 'var(--color-success)',
    flexShrink: 0,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--overlay-bg)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '560px',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: 'var(--fw-semibold)',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  guideBox: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    fontSize: '0.78rem',
  },
  guideTitle: {
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--accent-primary)',
    marginBottom: '0.4rem',
  },
  guideList: {
    margin: 0,
    paddingLeft: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    color: 'var(--text-secondary)',
  },
  modalBtnRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.65rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    border: 'none',
    cursor: 'pointer',
  },
  deleteVideoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
    color: 'var(--color-error)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.65rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    padding: '0.65rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-semibold)',
  },
  backBtn: {
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
};
