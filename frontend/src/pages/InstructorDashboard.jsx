import { useState, useEffect, lazy, Suspense } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  FiBookOpen, FiPlus, FiFolder, FiPlay, FiPlusCircle, FiUpload, 
  FiCheckCircle, FiEdit2, FiTrash2, FiLink, FiShield, FiUser, 
  FiArrowLeft, FiX, FiVideo, FiClock, FiCheck, FiLayers, FiTag
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import PageLoader from '../components/common/PageLoader';
import PriceRequestModal from '../components/payments/PriceRequestModal';
import paymentService from '../services/paymentService';
import { formatMinor, isPaidCourse } from '../utils/money';

const ProblemMakerModal = lazy(() => import('../components/coding/ProblemMakerModal'));

export default function InstructorDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    short_description: '',
    thumbnail_url: '',
    category: 'programming',
    difficulty: 'beginner',
    prerequisites: '',
    learning_objectives: ''
  });

  // Course Edit state
  const [editingCourse, setEditingCourse] = useState(null);
  const [editCourseForm, setEditCourseForm] = useState({
    title: '',
    short_description: '',
    description: '',
    thumbnail_url: '',
    category: 'programming',
    difficulty: 'beginner',
    prerequisites: '',
    learning_objectives: '',
    is_published: true
  });

  // Pricing: instructors suggest a price; admins approve it (live prices are admin-only)
  const [pricingCourse, setPricingCourse] = useState(null);
  const [myPriceRequests, setMyPriceRequests] = useState([]);

  // Module state
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', order_index: 0 });
  const [editingModule, setEditingModule] = useState(null);
  const [editModuleForm, setEditModuleForm] = useState({ title: '', description: '', order_index: 0 });

  // Lecture state
  const [lectureForm, setLectureForm] = useState({
    module_id: '',
    title: '',
    description: '',
    duration_seconds: 600,
    order_index: 0,
    video_url: ''
  });
  const [editingLecture, setEditingLecture] = useState(null);
  const [editLectureForm, setEditLectureForm] = useState({
    title: '',
    description: '',
    duration_seconds: 600,
    order_index: 0,
    video_url: ''
  });

  // Video creation & upload state
  const [lectureVideoFile, setLectureVideoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [activeTab, setActiveTab] = useState('courses');

  // Coding problems states
  const [showCodingForm, setShowCodingForm] = useState(false);
  const [codingProblemsList, setCodingProblemsList] = useState([]);

  async function loadCodingProblems() {
    try {
      const res = await api.get('/coding/problems');
      setCodingProblemsList(res.data.items || []);
    } catch (err) {
      toast.error('Failed to load coding problems');
    }
  }

  useEffect(() => {
    if (activeTab === 'coding') {
      loadCodingProblems();
    }
  }, [activeTab]);

  // Load instructor or admin courses
  async function loadData() {
    setIsLoading(true);
    try {
      const res = await api.get('/courses/instructor/me');
      setCourses(res.data.items || []);
      if (!isAdmin) {
        paymentService.myPriceRequests()
          .then((r) => setMyPriceRequests(r.data || []))
          .catch(() => {});
      }
    } catch (err) {
      toast.error('Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Fetch modules when a course is selected
  async function fetchModules(courseId) {
    const id = courseId || selectedCourse?.id;
    if (!id) return;
    try {
      const res = await api.get(`/courses/${id}/modules`);
      setModules(res.data || []);
      if (res.data.length > 0) {
        setLectureForm(prev => ({ ...prev, module_id: res.data[0].id }));
      }
    } catch (err) {
      toast.error('Failed to load syllabus modules');
    }
  }

  useEffect(() => {
    if (selectedCourse) {
      fetchModules(selectedCourse.id);
    }
  }, [selectedCourse]);

  // ---------------- COURSE HANDLERS ----------------
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/courses', courseForm);
      toast.success('Course created successfully!');
      setShowCreateForm(false);
      setCourseForm({
        title: '',
        description: '',
        short_description: '',
        thumbnail_url: '',
        category: 'programming',
        difficulty: 'beginner',
        prerequisites: '',
        learning_objectives: ''
      });
      await loadData();
      setSelectedCourse(res.data);
      setActiveTab('builder');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditCourseModal = (course) => {
    setEditingCourse(course);
    setEditCourseForm({
      title: course.title || '',
      short_description: course.short_description || '',
      description: course.description || '',
      thumbnail_url: course.thumbnail_url || '',
      category: course.category || 'programming',
      difficulty: course.difficulty || 'beginner',
      prerequisites: course.prerequisites || '',
      learning_objectives: course.learning_objectives || '',
      is_published: course.is_published ?? true
    });
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    if (!editingCourse) return;
    setIsSubmitting(true);
    try {
      const res = await api.put(`/courses/${editingCourse.id}`, editCourseForm);
      toast.success('Course updated successfully!');
      setEditingCourse(null);
      if (selectedCourse && selectedCourse.id === editingCourse.id) {
        setSelectedCourse(res.data);
      }
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId, courseTitle) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete course "${courseTitle}"? This will delete all modules, lectures, and enrollments.`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/courses/${courseId}`);
      toast.success('Course deleted successfully');
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
        setActiveTab('courses');
      }
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete course');
    }
  };

  const handlePublishCourse = async () => {
    if (!selectedCourse) return;
    try {
      await api.put(`/courses/${selectedCourse.id}`, { is_published: true });
      toast.success('Course published! Accessible to all students.');
      loadData();
      setSelectedCourse(prev => ({ ...prev, is_published: true }));
    } catch (err) {
      toast.error('Failed to publish course');
    }
  };

  // ---------------- MODULE HANDLERS ----------------
  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsSubmitting(true);
    try {
      await api.post(`/courses/${selectedCourse.id}/modules`, {
        ...moduleForm,
        order_index: modules.length
      });
      toast.success('Module added');
      setModuleForm({ title: '', description: '', order_index: 0 });
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error('Failed to add module');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModuleModal = (module) => {
    setEditingModule(module);
    setEditModuleForm({
      title: module.title || '',
      description: module.description || '',
      order_index: module.order_index || 0
    });
  };

  const handleUpdateModule = async (e) => {
    e.preventDefault();
    if (!editingModule) return;
    setIsSubmitting(true);
    try {
      await api.put(`/courses/modules/${editingModule.id}`, editModuleForm);
      toast.success('Module updated successfully');
      setEditingModule(null);
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update module');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteModule = async (moduleId, moduleTitle) => {
    const confirmDelete = window.confirm(
      `Delete module "${moduleTitle}" and all its lectures?`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/courses/modules/${moduleId}`);
      toast.success('Module deleted');
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete module');
    }
  };

  const moveModule = async (index, direction) => {
    const newModules = [...modules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModules.length) return;
    
    const temp = newModules[index];
    newModules[index] = newModules[targetIndex];
    newModules[targetIndex] = temp;
    
    const updatedPayload = {
      modules: newModules.map((m, mIdx) => ({
        id: m.id,
        order_index: mIdx,
        lectures: (m.lectures || []).map((l, lIdx) => ({
          id: l.id,
          order_index: lIdx
        }))
      }))
    };
    
    try {
      await api.put(`/course-builder/${selectedCourse.id}/reorder`, updatedPayload);
      setModules(newModules);
      toast.success('Module reordered');
    } catch (err) {
      toast.error('Failed to reorder modules');
    }
  };

  // ---------------- LECTURE HANDLERS ----------------
  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!lectureForm.module_id) {
      toast.error('Please select a module first');
      return;
    }
    if (!lectureForm.title.trim()) {
      toast.error('Lecture title is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post(`/lectures/modules/${lectureForm.module_id}`, {
        title: lectureForm.title.trim(),
        description: lectureForm.description,
        duration_seconds: parseInt(lectureForm.duration_seconds || 600),
        order_index: parseInt(lectureForm.order_index || 0),
        video_url: lectureForm.video_url?.trim() || null
      });
      const createdLecture = res.data;

      // If a video file was selected during creation, upload it immediately in one smooth flow
      if (lectureVideoFile && createdLecture?.id) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', lectureVideoFile);
        await api.post(`/lectures/${createdLecture.id}/video`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Lecture created and video attached successfully!');
      } else {
        toast.success('Lecture created successfully');
      }

      setLectureForm(prev => ({
        ...prev,
        title: '',
        description: '',
        duration_seconds: 600,
        order_index: 0,
        video_url: ''
      }));
      setLectureVideoFile(null);
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add lecture');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const openEditLectureModal = (lecture) => {
    setEditingLecture(lecture);
    setEditLectureForm({
      title: lecture.title || '',
      description: lecture.description || '',
      duration_seconds: lecture.duration_seconds || 600,
      order_index: lecture.order_index || 0,
      video_url: lecture.source_url || lecture.video_url || ''
    });
  };

  const handleUpdateLecture = async (e) => {
    e.preventDefault();
    if (!editingLecture) return;
    setIsSubmitting(true);
    try {
      await api.put(`/lectures/${editingLecture.id}`, {
        title: editLectureForm.title,
        description: editLectureForm.description,
        duration_seconds: parseInt(editLectureForm.duration_seconds || 600),
        order_index: parseInt(editLectureForm.order_index || 0),
        video_url: editLectureForm.video_url?.trim() || null
      });
      toast.success('Lecture updated');
      setEditingLecture(null);
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update lecture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLecture = async (lectureId, lectureTitle) => {
    const confirmDelete = window.confirm(`Delete lecture "${lectureTitle}"?`);
    if (!confirmDelete) return;

    try {
      await api.delete(`/lectures/${lectureId}`);
      toast.success('Lecture deleted');
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete lecture');
    }
  };

  const handleRemoveLectureVideo = async (lectureId, lectureTitle) => {
    const confirmRemove = window.confirm(`Are you sure you want to remove the video from "${lectureTitle}"?`);
    if (!confirmRemove) return;

    try {
      await api.delete(`/lectures/${lectureId}/video`);
      toast.success('Video removed from lecture');
      fetchModules(selectedCourse.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove video');
    }
  };

  const moveLecture = async (moduleIndex, lectureIndex, direction) => {
    const newModules = [...modules];
    const module = { ...newModules[moduleIndex] };
    const lectures = [...(module.lectures || [])];
    const targetIndex = direction === 'up' ? lectureIndex - 1 : lectureIndex + 1;
    if (targetIndex < 0 || targetIndex >= lectures.length) return;
    
    const temp = lectures[lectureIndex];
    lectures[lectureIndex] = lectures[targetIndex];
    lectures[targetIndex] = temp;
    
    module.lectures = lectures;
    newModules[moduleIndex] = module;
    
    const updatedPayload = {
      modules: newModules.map((m, mIdx) => ({
        id: m.id,
        order_index: mIdx,
        lectures: (m.lectures || []).map((l, lIdx) => ({
          id: l.id,
          order_index: lIdx
        }))
      }))
    };
    
    try {
      await api.put(`/course-builder/${selectedCourse.id}/reorder`, updatedPayload);
      setModules(newModules);
      toast.success('Lecture reordered');
    } catch (err) {
      toast.error('Failed to reorder lectures');
    }
  };



  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ ...styles.title, margin: 0 }}>Courses & Syllabus</h1>
            <span style={styles.roleBadge}>{user?.role?.toUpperCase() || 'INSTRUCTOR'}</span>
          </div>
        </div>
      </div>

      <div style={styles.tabsRow}>
        <button
          onClick={() => { setSelectedCourse(null); setActiveTab('courses'); }}
          style={activeTab === 'courses' && !selectedCourse ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          <FiBookOpen style={{ marginRight: '6px' }} />
          {isAdmin ? 'All Platform Courses' : 'My Courses'} ({courses.length})
        </button>
        <button
          onClick={() => { setSelectedCourse(null); setActiveTab('coding'); }}
          style={activeTab === 'coding' ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          Coding Problems ({codingProblemsList.length})
        </button>
        {selectedCourse && (
          <button
            onClick={() => setActiveTab('builder')}
            style={activeTab === 'builder' ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
          >
            <FiLayers style={{ marginRight: '6px' }} />
            Course Studio: {selectedCourse.title}
          </button>
        )}
      </div>

      {/* Course List Tab */}
      {activeTab === 'courses' && !selectedCourse && (
        <div style={styles.tabContent}>
          {showCreateForm ? (
            <form onSubmit={handleCreateCourse} style={styles.formCard}>
              <div style={styles.formCardHeader}>
                <h2 style={styles.sectionHeading}>Create Course</h2>
                <button type="button" onClick={() => setShowCreateForm(false)} style={styles.closeBtn}>
                  <FiX size={20} />
                </button>
              </div>

              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Course Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Modern Full-Stack Web Development"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category *</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    style={styles.select}
                  >
                    <option value="programming">Programming</option>
                    <option value="web_development">Web Development</option>
                    <option value="machine_learning">Machine Learning</option>
                    <option value="artificial_intelligence">AI</option>
                    <option value="data_science">Data Science</option>
                    <option value="dsa">Data Structures & Algorithms</option>
                    <option value="cyber_security">Cyber Security</option>
                    <option value="devops">DevOps & Cloud</option>
                    <option value="cloud">Cloud Computing</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty Level *</label>
                  <select
                    value={courseForm.difficulty}
                    onChange={(e) => setCourseForm({ ...courseForm, difficulty: e.target.value })}
                    style={styles.select}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tuition Price</label>
                  <input
                    type="text"
                    disabled
                    value="Free at launch"
                    style={{ ...styles.input, opacity: 0.7, cursor: 'not-allowed' }}
                  />
                  <span style={styles.helperText}>
                    {isAdmin ? 'Set the live price in Admin Panel → Course Pricing after creating the course.'
                      : 'After creating the course, use Pricing on its card to request a price for admin approval.'}
                  </span>
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Short Summary *</label>
                  <input
                    type="text"
                    placeholder="Brief 1-line overview of the course"
                    value={courseForm.short_description}
                    onChange={(e) => setCourseForm({ ...courseForm, short_description: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Detailed Description & Syllabus Highlights *</label>
                  <textarea
                    placeholder="Detailed explanation of curriculum, hands-on projects, and skills acquired..."
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    style={styles.textarea}
                    required
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Prerequisites</label>
                  <input
                    type="text"
                    placeholder="e.g. Basic JavaScript, HTML & CSS knowledge"
                    value={courseForm.prerequisites}
                    onChange={(e) => setCourseForm({ ...courseForm, prerequisites: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Course Logo / Thumbnail URL</label>
                  <input
                    type="url"
                    placeholder="https://... (direct image link, optional)"
                    value={courseForm.thumbnail_url}
                    onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Learning Objectives</label>
                  <input
                    type="text"
                    placeholder="e.g. Build production apps, master system design, pass coding interviews"
                    value={courseForm.learning_objectives}
                    onChange={(e) => setCourseForm({ ...courseForm, learning_objectives: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>
              <div style={styles.btnRow}>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  <FiPlus /> {isSubmitting ? 'Creating Course...' : 'Create Course'}
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={styles.actionsRow}>
                <div style={styles.courseCountNote}>
                  Showing <strong>{courses.length}</strong> available courses
                </div>
                <button onClick={() => setShowCreateForm(true)} style={styles.createBtn}>
                  <FiPlus /> Create New Course
                </button>
              </div>

              {courses.length === 0 ? (
                <div style={styles.emptyState}>
                  <FiBookOpen size={48} />
                  <p>No courses found. Click Create New Course to get started.</p>
                </div>
              ) : (
                <div style={styles.grid}>
                  {courses.map((course) => (
                    <div key={course.id} style={styles.card}>
                      <div style={styles.cardTop}>
                        <div style={styles.courseCategoryTag}>
                          {course.category?.replace('_', ' ').toUpperCase()}
                        </div>
                        {isPaidCourse(course) ? (
                          <div style={styles.paidBadge}>{formatMinor(course.price_amount, course.currency)}</div>
                        ) : (
                          <div style={styles.freeBadge}>FREE</div>
                        )}
                      </div>

                      <h3 style={styles.cardTitle}>{course.title}</h3>
                      <p style={styles.cardDesc}>{course.short_description || course.description}</p>
                      
                      {isAdmin && course.instructor_name && (
                        <div style={styles.instructorTag}>
                          <FiUser size={13} />
                          <span>Instructor: <strong>{course.instructor_name}</strong></span>
                        </div>
                      )}

                      <div style={styles.cardStats}>
                        <span>{course.difficulty?.toUpperCase()}</span>
                        <span>•</span>
                        <span>{course.total_lectures || 0} Lectures</span>
                        <span>•</span>
                        <span>{course.enrollment_count || 0} Enrolled</span>
                      </div>

                      <div style={styles.statusRow}>
                        <span style={styles.statusBadge}>
                          {course.is_approved ? 'Approved & Live' : course.is_published ? 'Pending Approval' : 'Draft'}
                        </span>
                      </div>

                      {/* Course Action Buttons */}
                      <div style={styles.cardActions}>
                        <button
                          onClick={() => { setSelectedCourse(course); setActiveTab('builder'); }}
                          style={styles.manageBtn}
                          title="Open course syllabus, modules, and video manager"
                        >
                          <FiLayers size={15} /> Manage Syllabus
                        </button>
                        <button
                          onClick={() => openEditCourseModal(course)}
                          style={styles.editActionBtn}
                          title="Edit course details"
                        >
                          <FiEdit2 size={15} /> Edit
                        </button>
                        {isAdmin ? (
                          <Link to="/admin?tab=pricing" style={styles.editActionBtn} title="Set the live price">
                            <FiTag size={15} /> Price
                          </Link>
                        ) : (
                          <button
                            onClick={() => setPricingCourse(course)}
                            style={styles.editActionBtn}
                            title="Request a price change (admin approval required)"
                          >
                            <FiTag size={15} /> Pricing
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCourse(course.id, course.title)}
                          style={styles.deleteActionBtn}
                          title="Delete course"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coding Problems Tab */}
      {activeTab === 'coding' && (
        <div style={styles.tabContent}>
          <div style={styles.actionsRow}>
            <button onClick={() => setShowCodingForm(true)} style={styles.createBtn}>
              <FiPlus /> Create Coding Problem
            </button>
          </div>

          <Suspense fallback={null}>
            <ProblemMakerModal
              isOpen={showCodingForm}
              onClose={() => setShowCodingForm(false)}
              onSuccess={() => {
                loadCodingProblems();
                setShowCodingForm(false);
              }}
            />
          </Suspense>

          {codingProblemsList.length === 0 ? (
            <div style={styles.emptyState}>
              <FiBookOpen size={48} />
              <p>No coding problems created yet. Click Create Coding Problem to get started.</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {codingProblemsList.map((prob) => (
                <div key={prob.id} style={styles.card}>
                  <h3 style={styles.cardTitle}>{prob.title}</h3>
                  <div style={styles.statusRow}>
                    <span style={{
                      ...styles.statusBadge,
                      color: prob.difficulty === 'easy' || prob.difficulty === 'EASY' ? 'var(--color-success)' : prob.difficulty === 'medium' || prob.difficulty === 'MEDIUM' ? 'var(--color-warning)' : 'var(--color-error)'
                    }}>
                      {prob.difficulty?.toUpperCase()}
                    </span>
                    <span style={styles.studentsCount}>
                      Acceptance: {prob.acceptance_rate}%
                    </span>
                  </div>
                  <p style={styles.cardDesc}>
                    Submissions: {prob.total_submissions} ({prob.accepted_submissions} accepted)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Course Builder Tab */}
      {activeTab === 'builder' && selectedCourse && (
        <div>
          <div style={styles.builderTopBar}>
            <button onClick={() => { setSelectedCourse(null); setActiveTab('courses'); }} style={styles.backBtn}>
              <FiArrowLeft /> Back to Courses
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => openEditCourseModal(selectedCourse)} style={styles.secondaryHeaderBtn}>
                <FiEdit2 /> Edit Course Info
              </button>
              {!selectedCourse.is_published ? (
                <button onClick={handlePublishCourse} style={styles.publishBtn}>
                  <FiCheck /> Publish Course
                </button>
              ) : (
                <span style={styles.publishedTag}>
                  <FiCheckCircle /> Published & Live
                </span>
              )}
            </div>
          </div>

          <div className="r-stack" style={styles.builderLayout}>
            {/* Left Column: Creator Panels */}
            <div style={styles.builderForms}>
              {/* Add Module */}
              <div style={styles.builderCard}>
                <div style={styles.builderCardHeader}>
                  <FiFolder style={{ color: 'var(--accent-primary)' }} size={20} />
                  <h3 style={styles.cardHeaderTitle}>Add Syllabus Topic / Module</h3>
                </div>
                <form onSubmit={handleCreateModule} style={styles.verticalForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Module Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Module 1: Foundations & Architecture"
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Module Description (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Core concepts, setup, and key principles"
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                    <FiPlusCircle /> Add Module
                  </button>
                </form>
              </div>

              {/* Add Lecture */}
              <div style={styles.builderCard}>
                <div style={styles.builderCardHeader}>
                  <FiPlay style={{ color: 'var(--accent-primary)' }} size={20} />
                  <h3 style={styles.cardHeaderTitle}>Add Lecture / Lesson</h3>
                </div>
                <form onSubmit={handleCreateLecture} style={styles.verticalForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Target Module *</label>
                    <select
                      value={lectureForm.module_id}
                      onChange={(e) => setLectureForm({ ...lectureForm, module_id: e.target.value })}
                      style={styles.select}
                      required
                    >
                      {modules.length === 0 && <option value="">No modules yet - add a module above</option>}
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Lecture Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Introduction to Clean Architecture"
                      value={lectureForm.title}
                      onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Duration (seconds)</label>
                    <input
                      type="number"
                      placeholder="600"
                      value={lectureForm.duration_seconds}
                      onChange={(e) => setLectureForm({ ...lectureForm, duration_seconds: parseInt(e.target.value) || 0 })}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      <FiVideo style={{ marginRight: '5px' }} /> Video Link / Stream URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://... direct MP4, YouTube, Vimeo, or CDN link"
                      value={lectureForm.video_url}
                      onChange={(e) => {
                        setLectureForm({ ...lectureForm, video_url: e.target.value });
                        if (e.target.value) setLectureVideoFile(null);
                      }}
                      style={styles.input}
                      disabled={!!lectureVideoFile}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      <FiUpload style={{ marginRight: '5px' }} /> Or Choose Video File (MP4, WebM)
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setLectureVideoFile(file);
                        if (file) {
                          setLectureForm(prev => ({ ...prev, video_url: '' }));
                        }
                      }}
                      style={styles.fileInput}
                      disabled={!!lectureForm.video_url?.trim()}
                    />
                    {lectureVideoFile && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                        <span>Selected: {lectureVideoFile.name} ({(lectureVideoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                        <button
                          type="button"
                          onClick={() => setLectureVideoFile(null)}
                          style={{ ...styles.cancelBtn, padding: '2px 8px', fontSize: '0.75rem' }}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <small style={styles.helperText}>Provide a video link OR select a file. The video will attach immediately upon creation.</small>
                  </div>

                  <button type="submit" disabled={isSubmitting || isUploading || modules.length === 0} style={styles.submitBtn}>
                    {isUploading ? <><FiUpload /> Uploading Video File...</> : isSubmitting ? 'Creating Lecture...' : <><FiPlus /> Create Lecture</>}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Interactive Syllabus Preview with Edit & Delete */}
            <div style={styles.syllabusPreview}>
              <div style={styles.previewHeader}>
                <h3 style={styles.sectionHeading}>Curriculum & Syllabus</h3>
                <div style={styles.lectureCounterBadge}>
                  {modules.reduce((acc, m) => acc + (m.lectures?.length || 0), 0)} Total Lectures
                </div>
              </div>

              <div style={styles.previewContent}>
                {modules.length === 0 ? (
                  <div style={styles.emptySyllabusBox}>
                    <FiFolder size={36} color="var(--text-muted)" />
                    <p style={styles.noModules}>No topics/modules created yet. Use the sidebar to add your first module.</p>
                  </div>
                ) : (
                  modules.map((m, mIdx) => (
                    <div key={m.id} style={styles.previewModule}>
                      <div style={styles.previewModuleHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                          <FiFolder style={styles.folderIcon} size={18} />
                          <div>
                            <span style={styles.moduleTitleText}>{m.title}</span>
                            {m.description && <div style={styles.moduleDescText}>{m.description}</div>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button 
                            type="button" 
                            onClick={() => moveModule(mIdx, 'up')} 
                            disabled={mIdx === 0} 
                            style={{ ...styles.orderBtn, opacity: mIdx === 0 ? 0.3 : 1 }} 
                            title="Move Module Up"
                          >
                            ▲
                          </button>
                          <button 
                            type="button" 
                            onClick={() => moveModule(mIdx, 'down')} 
                            disabled={mIdx === modules.length - 1} 
                            style={{ ...styles.orderBtn, opacity: mIdx === modules.length - 1 ? 0.3 : 1 }} 
                            title="Move Module Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModuleModal(m)}
                            style={styles.moduleEditBtn}
                            title="Edit Module Title"
                          >
                            <FiEdit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(m.id, m.title)}
                            style={styles.moduleDeleteBtn}
                            title="Delete Module & Lectures"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Lectures list inside module */}
                      <div style={styles.previewLecturesList}>
                        {(!m.lectures || m.lectures.length === 0) ? (
                          <div style={styles.emptyLecturesNotice}>
                            No lectures in this module yet. Add lectures from the left panel.
                          </div>
                        ) : (
                          m.lectures.map((l, lIdx) => (
                            <div key={l.id} style={styles.previewLectureItem}>
                              <div style={styles.previewLecLeft}>
                                <span style={styles.lectureNumberBadge} title={`Lesson ${lIdx + 1}`}>
                                  {lIdx + 1}
                                </span>
                                <FiPlay style={styles.playIcon} size={14} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={styles.lectureItemTitle}>
                                    {l.title ? l.title.replace(/^\d+[\.\s\-]+/, '') : `Lesson ${lIdx + 1}`}
                                  </span>
                                  <div style={styles.lectureItemMeta}>
                                    <FiClock size={11} /> {Math.round(l.duration_seconds / 60)} min
                                    {(l.has_video || l.video_url) ? (
                                      <span style={styles.videoActiveBadge}>
                                        <FiCheckCircle size={11} /> Video Ready
                                      </span>
                                    ) : (
                                      <span style={styles.videoMissingBadge}>
                                        No Video Attached
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <button 
                                  type="button" 
                                  onClick={() => moveLecture(mIdx, lIdx, 'up')} 
                                  disabled={lIdx === 0} 
                                  style={{ ...styles.orderBtnSmall, opacity: lIdx === 0 ? 0.3 : 1 }} 
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => moveLecture(mIdx, lIdx, 'down')} 
                                  disabled={lIdx === m.lectures.length - 1} 
                                  style={{ ...styles.orderBtnSmall, opacity: lIdx === m.lectures.length - 1 ? 0.3 : 1 }} 
                                  title="Move Down"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditLectureModal(l)}
                                  style={styles.lectureEditBtn}
                                  title="Edit Lecture & Video URL"
                                >
                                  <FiEdit2 size={13} />
                                </button>
                                {(l.has_video || l.video_url) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLectureVideo(l.id, l.title)}
                                    style={{ ...styles.lectureDeleteBtn, color: 'var(--color-warning)' }}
                                    title="Remove Video from Lecture"
                                  >
                                    <FiX size={13} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLecture(l.id, l.title)}
                                  style={styles.lectureDeleteBtn}
                                  title="Delete Lecture"
                                >
                                  <FiTrash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {pricingCourse && (
        <PriceRequestModal
          course={pricingCourse}
          requests={myPriceRequests.filter((r) => r.course_id === pricingCourse.id)}
          onClose={() => setPricingCourse(null)}
          onSubmitted={() => { setPricingCourse(null); loadData(); }}
        />
      )}

      {/* ---------------- EDIT COURSE MODAL ---------------- */}
      {editingCourse && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Course Information</h3>
              <button onClick={() => setEditingCourse(null)} style={styles.closeBtn}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateCourse} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Course Title *</label>
                <input
                  type="text"
                  value={editCourseForm.title}
                  onChange={(e) => setEditCourseForm({ ...editCourseForm, title: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category</label>
                  <select
                    value={editCourseForm.category}
                    onChange={(e) => setEditCourseForm({ ...editCourseForm, category: e.target.value })}
                    style={styles.select}
                  >
                    <option value="programming">Programming</option>
                    <option value="web_development">Web Development</option>
                    <option value="machine_learning">Machine Learning</option>
                    <option value="artificial_intelligence">AI</option>
                    <option value="data_science">Data Science</option>
                    <option value="dsa">DSA</option>
                    <option value="cyber_security">Cyber Security</option>
                    <option value="devops">DevOps</option>
                    <option value="cloud">Cloud</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty</label>
                  <select
                    value={editCourseForm.difficulty}
                    onChange={(e) => setEditCourseForm({ ...editCourseForm, difficulty: e.target.value })}
                    style={styles.select}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Short Summary</label>
                <input
                  type="text"
                  value={editCourseForm.short_description}
                  onChange={(e) => setEditCourseForm({ ...editCourseForm, short_description: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Detailed Description</label>
                <textarea
                  value={editCourseForm.description}
                  onChange={(e) => setEditCourseForm({ ...editCourseForm, description: e.target.value })}
                  style={styles.textarea}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Learning Objectives</label>
                <input
                  type="text"
                  value={editCourseForm.learning_objectives}
                  onChange={(e) => setEditCourseForm({ ...editCourseForm, learning_objectives: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Course Logo / Thumbnail URL</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="url"
                    placeholder="https://... (direct image link)"
                    value={editCourseForm.thumbnail_url}
                    onChange={(e) => setEditCourseForm({ ...editCourseForm, thumbnail_url: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  {editCourseForm.thumbnail_url && (
                    <button
                      type="button"
                      onClick={() => setEditCourseForm({ ...editCourseForm, thumbnail_url: '' })}
                      style={{ ...styles.cancelBtn, padding: '0 12px', fontSize: '0.8rem' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Or Upload Logo File (PNG, JPG, WEBP)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !editingCourse) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                      const res = await api.post(`/courses/${editingCourse.id}/thumbnail`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      toast.success('Course logo uploaded successfully');
                      setEditCourseForm(prev => ({ ...prev, thumbnail_url: res.data.thumbnail_url || prev.thumbnail_url }));
                      loadData();
                    } catch (err) {
                      toast.error('Failed to upload logo');
                    }
                  }}
                  style={styles.fileInput}
                />
              </div>
              <div style={styles.btnRow}>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingCourse(null)} style={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- EDIT MODULE MODAL ---------------- */}
      {editingModule && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCardSmall}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Topic / Module</h3>
              <button onClick={() => setEditingModule(null)} style={styles.closeBtn}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateModule} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Module Title *</label>
                <input
                  type="text"
                  value={editModuleForm.title}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, title: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Module Description (optional)</label>
                <textarea
                  value={editModuleForm.description}
                  onChange={(e) => setEditModuleForm({ ...editModuleForm, description: e.target.value })}
                  style={{ ...styles.textarea, minHeight: '80px' }}
                />
              </div>
              <div style={styles.btnRow}>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  {isSubmitting ? 'Saving...' : 'Update Module'}
                </button>
                <button type="button" onClick={() => setEditingModule(null)} style={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- EDIT LECTURE MODAL ---------------- */}
      {editingLecture && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Lecture & Video</h3>
              <button onClick={() => setEditingLecture(null)} style={styles.closeBtn}>
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateLecture} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Lecture Title *</label>
                <input
                  type="text"
                  value={editLectureForm.title}
                  onChange={(e) => setEditLectureForm({ ...editLectureForm, title: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Duration (seconds)</label>
                  <input
                    type="number"
                    value={editLectureForm.duration_seconds}
                    onChange={(e) => setEditLectureForm({ ...editLectureForm, duration_seconds: parseInt(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Video URL (MP4 / Direct / Cloud CDN / Embed)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={editLectureForm.video_url}
                    onChange={(e) => setEditLectureForm({ ...editLectureForm, video_url: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  {editLectureForm.video_url && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.delete(`/lectures/${editingLecture.id}/video`);
                          toast.success('Video removed from lecture');
                          setEditLectureForm(prev => ({ ...prev, video_url: '' }));
                          fetchModules(selectedCourse.id);
                        } catch (e) {
                          toast.error('Failed to remove video');
                        }
                      }}
                      style={{ ...styles.cancelBtn, color: 'var(--color-error)', padding: '0 12px', fontSize: '0.8rem' }}
                    >
                      Clear Video
                    </button>
                  )}
                </div>
                <small style={styles.helperText}>Provide a direct MP4, Google Drive, YouTube, Vimeo, or Cloud CDN video link.</small>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Or Upload / Replace Video File (MP4, WebM)</label>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !editingLecture) return;
                    setIsUploading(true);
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                      const res = await api.post(`/lectures/${editingLecture.id}/video`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      toast.success('Video file uploaded successfully');
                      setEditLectureForm(prev => ({ ...prev, video_url: res.data?.file_url || 'uploaded' }));
                      fetchModules(selectedCourse.id);
                    } catch (err) {
                      toast.error(err.response?.data?.detail || 'Failed to upload video');
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  style={styles.fileInput}
                />
                <small style={styles.helperText}>Uploading a new video file will replace any current video on this lecture.</small>
              </div>
              <div style={styles.btnRow}>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  {isSubmitting ? 'Updating...' : 'Update Lecture'}
                </button>
                <button type="button" onClick={() => setEditingLecture(null)} style={styles.cancelBtn}>
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
    padding: '0 0 2.5rem 0',
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
    fontSize: '0.95rem',
  },
  roleBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem 1.5rem',
    marginBottom: '2rem',
  },
  roleTitle: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
  },
  roleSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  roleBadge: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.35rem 0.85rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold)',
    letterSpacing: '0.05em',
    color: 'var(--accent-primary)',
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
  tabsRow: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '1px',
    marginBottom: '2.5rem',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
    cursor: 'pointer',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: 'transparent',
    transition: 'all 0.2s ease',
  },
  activeTab: {
    color: 'var(--accent-primary)',
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-primary) var(--border-primary) var(--bg-card)',
  },
  tabContent: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
  },
  formCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  formCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  freeBadgeNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    backgroundColor: 'var(--color-success-bg)',
    border: '1px solid var(--color-success-bg)',
    padding: '0.75rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    gap: '1.5rem',
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
  select: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  textarea: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    minHeight: '110px',
    resize: 'vertical',
    outline: 'none',
  },
  helperText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  checkboxWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  btnRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  submitBtn: {
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    border: 'none',
  },
  cancelBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  courseCountNote: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  createBtn: {
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    border: 'none',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '4rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    transition: 'transform 0.15s ease, border-color 0.15s ease',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseCategoryTag: {
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
    letterSpacing: '0.05em',
  },
  freeBadge: {
    backgroundColor: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-bold)',
  },
  paidBadge: {
    backgroundColor: 'var(--primary-subtle)',
    color: 'var(--primary-text)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-bold)',
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
    lineHeight: '1.35',
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
    flex: 1,
  },
  instructorTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-primary)',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  cardStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
  },
  statusBadge: {
    backgroundColor: 'var(--bg-primary)',
    padding: '0.25rem 0.6rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
  },
  studentsCount: {
    color: 'var(--text-secondary)',
  },
  cardActions: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  manageBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    padding: '0.6rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    fontWeight: 'var(--fw-medium)',
    cursor: 'pointer',
  },
  editActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.3rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.6rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  deleteActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
    color: 'var(--color-error)',
    padding: '0.6rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  builderTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  secondaryHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  publishBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    backgroundColor: 'var(--success-solid)',
    color: '#FFFFFF',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.6rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',
  },
  publishedTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--color-success)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    backgroundColor: 'var(--color-success-bg)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
  },
  builderLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.3fr',
    gap: '2rem',
  },
  builderForms: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  builderCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  builderCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.6rem',
  },
  cardHeaderTitle: {
    fontSize: '1.05rem',
    fontWeight: 'var(--fw-semibold)',
  },
  verticalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  iconSubmitBtn: {
    backgroundColor: 'var(--primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: 'pointer',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0.5rem 0',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-bold)',
    letterSpacing: '0.05em',
  },
  fileInput: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  syllabusPreview: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    height: 'fit-content',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  previewSubhead: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  lectureCounterBadge: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.3rem 0.75rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--accent-primary)',
  },
  previewContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  emptySyllabusBox: {
    textAlign: 'center',
    padding: '3rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  noModules: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  previewModule: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
  },
  previewModuleHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  moduleTitleText: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-primary)',
  },
  moduleDescText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  folderIcon: {
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  moduleEditBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '4px 6px',
    display: 'flex',
    alignItems: 'center',
  },
  moduleDeleteBtn: {
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
    color: 'var(--color-error)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '4px 6px',
    display: 'flex',
    alignItems: 'center',
  },
  previewLecturesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    paddingLeft: '1rem',
  },
  emptyLecturesNotice: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '0.5rem 0',
  },
  previewLectureItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '0.65rem 0.85rem',
  },
  previewLecLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  lectureNumberBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '22px',
    height: '22px',
    padding: '0 5px',
    borderRadius: '4px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--accent-primary)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-bold, 700)',
    border: '1px solid var(--border-primary)',
    flexShrink: 0,
  },
  lectureItemTitle: {
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    fontSize: '0.875rem',
  },
  lectureItemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  videoActiveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    color: 'var(--color-success)',
    fontWeight: 'var(--fw-semibold)',
  },
  videoMissingBadge: {
    color: 'var(--color-warning)',
  },
  playIcon: {
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  orderBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
  },
  orderBtnSmall: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '0.65rem',
    padding: '2px 5px',
    display: 'flex',
    alignItems: 'center',
  },
  lectureEditBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '3px',
    cursor: 'pointer',
    padding: '3px 5px',
    display: 'flex',
    alignItems: 'center',
  },
  lectureDeleteBtn: {
    backgroundColor: 'var(--color-error-bg)',
    border: '1px solid var(--color-error)',
    color: 'var(--color-error)',
    borderRadius: '3px',
    cursor: 'pointer',
    padding: '3px 5px',
    display: 'flex',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '650px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  modalCardSmall: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '480px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
};
