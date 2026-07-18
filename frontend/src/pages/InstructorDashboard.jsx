import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiBookOpen, FiPlus, FiFolder, FiPlay, FiCpu, FiPlusCircle, FiUpload, FiCheck, FiSettings, FiCheckCircle, FiCode } from 'react-icons/fi';

export default function InstructorDashboard() {
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
    category: 'programming',
    difficulty: 'beginner',
    price: 0,
    prerequisites: '',
    learning_objectives: ''
  });

  const [moduleForm, setModuleForm] = useState({ title: '', description: '', order_index: 0 });
  const [lectureForm, setLectureForm] = useState({
    module_id: '',
    title: '',
    description: '',
    duration_seconds: 600,
    is_preview: false,
    order_index: 0
  });

  const [videoFile, setVideoFile] = useState(null);
  const [selectedLectureId, setSelectedLectureId] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [activeTab, setActiveTab] = useState('courses');

  // Coding problems states
  const [showCodingForm, setShowCodingForm] = useState(false);
  const [codingProblemsList, setCodingProblemsList] = useState([]);
  const [codingForm, setCodingForm] = useState({
    title: '',
    description: '',
    difficulty: 'easy',
    constraints: '',
    input_format: '',
    output_format: '',
    starter_code_python: 'def solve(nums, target):\n    # Write your Python code here\n    pass\n',
    starter_code_javascript: 'function solve(nums, target) {\n    // Write your JavaScript code here\n}\n',
    test_cases: [
      { input_data: '', expected_output: '', is_hidden: false, time_limit_seconds: 2.0, memory_limit_mb: 256 }
    ]
  });

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

  const addTestCaseField = () => {
    setCodingForm(prev => ({
      ...prev,
      test_cases: [...prev.test_cases, { input_data: '', expected_output: '', is_hidden: false, time_limit_seconds: 2.0, memory_limit_mb: 256 }]
    }));
  };

  const removeTestCaseField = (index) => {
    if (codingForm.test_cases.length <= 1) return;
    setCodingForm(prev => ({
      ...prev,
      test_cases: prev.test_cases.filter((_, idx) => idx !== index)
    }));
  };

  const updateTestCaseField = (index, field, value) => {
    setCodingForm(prev => ({
      ...prev,
      test_cases: prev.test_cases.map((tc, idx) => idx === index ? { ...tc, [field]: value } : tc)
    }));
  };

  const handleCreateCodingProblem = async (e) => {
    e.preventDefault();
    if (!codingForm.title || !codingForm.description) {
      toast.error('Please enter a title and description');
      return;
    }
    const testCases = codingForm.test_cases
      .filter(tc => tc.input_data.trim() !== '' && tc.expected_output.trim() !== '')
      .map((tc, idx) => ({
        ...tc,
        order_index: idx,
        time_limit_seconds: parseFloat(tc.time_limit_seconds || 2.0),
        memory_limit_mb: parseInt(tc.memory_limit_mb || 256)
      }));
      
    if (testCases.length === 0) {
      toast.error('Please add at least one valid test case');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/coding/problems', {
        ...codingForm,
        test_cases: testCases
      });
      toast.success('Coding problem created successfully!');
      setShowCodingForm(false);
      setCodingForm({
        title: '',
        description: '',
        difficulty: 'easy',
        constraints: '',
        input_format: '',
        output_format: '',
        starter_code_python: 'def solve(nums, target):\n    # Write your Python code here\n    pass\n',
        starter_code_javascript: 'function solve(nums, target) {\n    // Write your JavaScript code here\n}\n',
        test_cases: [{ input_data: '', expected_output: '', is_hidden: false, time_limit_seconds: 2.0, memory_limit_mb: 256 }]
      });
      loadCodingProblems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create coding problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load instructor data
  async function loadData() {
    setIsLoading(true);
    try {
      const res = await api.get('/courses/instructor/me');
      setCourses(res.data.items || []);
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
  useEffect(() => {
    if (!selectedCourse) return;
    async function fetchModules() {
      try {
        const res = await api.get(`/courses/${selectedCourse.id}/modules`);
        setModules(res.data || []);
        if (res.data.length > 0) {
          setLectureForm(prev => ({ ...prev, module_id: res.data[0].id }));
        }
      } catch (err) {
        toast.error('Failed to load syllabus modules');
      }
    }
    fetchModules();
  }, [selectedCourse]);

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
        category: 'programming',
        difficulty: 'beginner',
        price: 0,
        prerequisites: '',
        learning_objectives: ''
      });
      loadData();
      setSelectedCourse(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsSubmitting(true);
    try {
      await api.post(`/courses/${selectedCourse.id}/modules`, moduleForm);
      toast.success('Module added');
      setModuleForm({ title: '', description: '', order_index: 0 });
      // Refresh modules
      const res = await api.get(`/courses/${selectedCourse.id}/modules`);
      setModules(res.data || []);
    } catch (err) {
      toast.error('Failed to add module');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!lectureForm.module_id) {
      toast.error('Please select or create a module first');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/lectures/modules/${lectureForm.module_id}`, {
        title: lectureForm.title,
        description: lectureForm.description,
        duration_seconds: parseInt(lectureForm.duration_seconds),
        is_preview: lectureForm.is_preview,
        order_index: parseInt(lectureForm.order_index)
      });
      toast.success('Lecture added successfully');
      setLectureForm(prev => ({
        ...prev,
        title: '',
        description: '',
        duration_seconds: 600,
        is_preview: false,
        order_index: 0
      }));
      // Refresh modules
      const res = await api.get(`/courses/${selectedCourse.id}/modules`);
      setModules(res.data || []);
    } catch (err) {
      toast.error('Failed to add lecture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadVideo = async (e) => {
    e.preventDefault();
    if (!selectedLectureId || !videoFile) {
      toast.error('Please select a lecture and select a video file');
      return;
    }

    const formData = new FormData();
    formData.append('file', videoFile);

    setIsUploading(true);
    try {
      await api.post(`/lectures/${selectedLectureId}/video`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Video uploaded successfully!');
      setVideoFile(null);
      // Refresh modules
      const res = await api.get(`/courses/${selectedCourse.id}/modules`);
      setModules(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublishCourse = async () => {
    if (!selectedCourse) return;
    try {
      await api.put(`/courses/${selectedCourse.id}`, { is_published: true });
      toast.success('Course published! Waiting for admin approval.');
      loadData();
      setSelectedCourse(prev => ({ ...prev, is_published: true }));
    } catch (err) {
      toast.error('Failed to publish course');
    }
  };

  const moveModule = async (index, direction) => {
    const newModules = [...modules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModules.length) return;
    
    // Swap
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

  const moveLecture = async (moduleIndex, lectureIndex, direction) => {
    const newModules = [...modules];
    const module = { ...newModules[moduleIndex] };
    const lectures = [...(module.lectures || [])];
    const targetIndex = direction === 'up' ? lectureIndex - 1 : lectureIndex + 1;
    if (targetIndex < 0 || targetIndex >= lectures.length) return;
    
    // Swap
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
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Configuring instructor workspace...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Instructor Dashboard</h1>
        <p style={styles.subtitle}>Create courses, organize modules, upload video lectures, and build assignments.</p>
      </div>

      <div style={styles.tabsRow}>
        <button
          onClick={() => { setSelectedCourse(null); setActiveTab('courses'); }}
          style={activeTab === 'courses' && !selectedCourse ? { ...styles.tabBtn, ...styles.activeTab } : styles.tabBtn}
        >
          My Courses ({courses.length})
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
            Course Builder: {selectedCourse.title}
          </button>
        )}
      </div>

      {/* Course List Tab */}
      {activeTab === 'courses' && !selectedCourse && (
        <div style={styles.tabContent}>
          {showCreateForm ? (
            <form onSubmit={handleCreateCourse} style={styles.formCard}>
              <h2 style={styles.sectionHeading}>Create a New Course</h2>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Course Title</label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Category</label>
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
                    <option value="dsa">DSA</option>
                    <option value="cyber_security">Cyber Security</option>
                    <option value="devops">DevOps</option>
                    <option value="cloud">Cloud</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty</label>
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
                  <label style={styles.label}>Price ($)</label>
                  <input
                    type="number"
                    value={courseForm.price}
                    onChange={(e) => setCourseForm({ ...courseForm, price: parseFloat(e.target.value) })}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Short Description</label>
                  <input
                    type="text"
                    value={courseForm.short_description}
                    onChange={(e) => setCourseForm({ ...courseForm, short_description: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Detailed Description</label>
                  <textarea
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    style={styles.textarea}
                    required
                  />
                </div>
              </div>
              <div style={styles.btnRow}>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  Create Course
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={styles.actionsRow}>
                <button onClick={() => setShowCreateForm(true)} style={styles.createBtn}>
                  <FiPlus /> Create New Course
                </button>
              </div>

              {courses.length === 0 ? (
                <div style={styles.emptyState}>
                  <FiBookOpen size={48} />
                  <p>You have not created any courses yet. Get started by clicking Create New Course.</p>
                </div>
              ) : (
                <div style={styles.grid}>
                  {courses.map((course) => (
                    <div key={course.id} style={styles.card}>
                      <h3 style={styles.cardTitle}>{course.title}</h3>
                      <p style={styles.cardDesc}>{course.short_description || course.description}</p>
                      <div style={styles.statusRow}>
                        <span style={styles.statusBadge}>
                          {course.is_approved ? 'Approved' : course.is_published ? 'Pending Approval' : 'Draft'}
                        </span>
                        <span style={styles.studentsCount}>
                          {course.enrollment_count} enrolled
                        </span>
                      </div>
                      <button
                        onClick={() => { setSelectedCourse(course); setActiveTab('builder'); }}
                        style={styles.editBtn}
                      >
                        Manage Syllabus
                      </button>
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
          {showCodingForm ? (
            <form onSubmit={handleCreateCodingProblem} style={styles.formCard}>
              <h2 style={styles.sectionHeading}>Create a New Coding Problem</h2>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Problem Title</label>
                  <input
                    type="text"
                    value={codingForm.title}
                    onChange={(e) => setCodingForm({ ...codingForm, title: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty</label>
                  <select
                    value={codingForm.difficulty}
                    onChange={(e) => setCodingForm({ ...codingForm, difficulty: e.target.value })}
                    style={styles.select}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    value={codingForm.description}
                    onChange={(e) => setCodingForm({ ...codingForm, description: e.target.value })}
                    style={styles.textarea}
                    placeholder="Describe the problem, input format, and output format..."
                    required
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Constraints</label>
                  <textarea
                    value={codingForm.constraints}
                    onChange={(e) => setCodingForm({ ...codingForm, constraints: e.target.value })}
                    style={styles.textarea}
                    placeholder="e.g. 1 <= nums.length <= 10^5"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Input Format</label>
                  <input
                    type="text"
                    value={codingForm.input_format}
                    onChange={(e) => setCodingForm({ ...codingForm, input_format: e.target.value })}
                    style={styles.input}
                    placeholder="e.g. Space-separated integers on line 1, target on line 2"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Output Format</label>
                  <input
                    type="text"
                    value={codingForm.output_format}
                    onChange={(e) => setCodingForm({ ...codingForm, output_format: e.target.value })}
                    style={styles.input}
                    placeholder="e.g. Two space-separated indices"
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Starter Code (Python)</label>
                  <textarea
                    value={codingForm.starter_code_python}
                    onChange={(e) => setCodingForm({ ...codingForm, starter_code_python: e.target.value })}
                    style={{ ...styles.textarea, fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Starter Code (JavaScript)</label>
                  <textarea
                    value={codingForm.starter_code_javascript}
                    onChange={(e) => setCodingForm({ ...codingForm, starter_code_javascript: e.target.value })}
                    style={{ ...styles.textarea, fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {/* Test Cases Section */}
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <h3 style={styles.subHeading}>Test Cases</h3>
                  <p style={styles.helpText}>Add inputs and expected outputs. Hidden test cases will not be visible to students.</p>
                  
                  <div style={styles.testCasesList}>
                    {codingForm.test_cases.map((tc, idx) => (
                      <div key={idx} style={styles.testCaseCard}>
                        <div style={styles.testCaseHeader}>
                          <span>Test Case #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeTestCaseField(idx)}
                            style={styles.removeTcBtn}
                            disabled={codingForm.test_cases.length <= 1}
                          >
                            Remove
                          </button>
                        </div>
                        <div style={styles.tcInputsGrid}>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Input Data</label>
                            <textarea
                              value={tc.input_data}
                              onChange={(e) => updateTestCaseField(idx, 'input_data', e.target.value)}
                              style={{ ...styles.textarea, minHeight: '60px' }}
                              placeholder="e.g. 2 7 11 15\n9"
                              required
                            />
                          </div>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Expected Output</label>
                            <textarea
                              value={tc.expected_output}
                              onChange={(e) => updateTestCaseField(idx, 'expected_output', e.target.value)}
                              style={{ ...styles.textarea, minHeight: '60px' }}
                              placeholder="e.g. 0 1"
                              required
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ ...styles.label, margin: 0, fontSize: '0.8125rem' }}>Time Limit (s):</label>
                            <input
                              type="number"
                              step="0.1"
                              value={tc.time_limit_seconds}
                              onChange={(e) => updateTestCaseField(idx, 'time_limit_seconds', e.target.value)}
                              style={{ ...styles.input, width: '80px', padding: '0.375rem 0.5rem' }}
                              required
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ ...styles.label, margin: 0, fontSize: '0.8125rem' }}>Memory Limit (MB):</label>
                            <input
                              type="number"
                              value={tc.memory_limit_mb}
                              onChange={(e) => updateTestCaseField(idx, 'memory_limit_mb', e.target.value)}
                              style={{ ...styles.input, width: '80px', padding: '0.375rem 0.5rem' }}
                              required
                            />
                          </div>
                          <label style={{ ...styles.checkboxLabel, margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={tc.is_hidden}
                              onChange={(e) => updateTestCaseField(idx, 'is_hidden', e.target.checked)}
                            />
                            Hidden Test Case
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={addTestCaseField} style={styles.addTcBtn}>
                    + Add Test Case
                  </button>
                </div>
              </div>

              <div style={styles.btnRow}>
                <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
                  Create Coding Problem
                </button>
                <button type="button" onClick={() => setShowCodingForm(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div style={styles.actionsRow}>
                <button onClick={() => setShowCodingForm(true)} style={styles.createBtn}>
                  <FiPlus /> Create Coding Problem
                </button>
              </div>

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
                          {prob.difficulty.toUpperCase()}
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
        </div>
      )}

      {/* Course Builder Tab */}
      {activeTab === 'builder' && selectedCourse && (
        <div style={styles.builderLayout}>
          {/* Left panel: Add module & Add lecture */}
          <div style={styles.builderForms}>
            <div style={styles.builderCard}>
              <h3 style={styles.sectionHeading}>Add Module</h3>
              <form onSubmit={handleCreateModule} style={styles.inlineForm}>
                <input
                  type="text"
                  placeholder="Module Title"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  style={styles.input}
                  required
                />
                <button type="submit" style={styles.iconSubmitBtn}>
                  <FiPlusCircle /> Add Module
                </button>
              </form>
            </div>

            <div style={styles.builderCard}>
              <h3 style={styles.sectionHeading}>Add Lecture</h3>
              <form onSubmit={handleCreateLecture} style={styles.verticalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Module</label>
                  <select
                    value={lectureForm.module_id}
                    onChange={(e) => setLectureForm({ ...lectureForm, module_id: e.target.value })}
                    style={styles.select}
                  >
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Lecture Title</label>
                  <input
                    type="text"
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
                    value={lectureForm.duration_seconds}
                    onChange={(e) => setLectureForm({ ...lectureForm, duration_seconds: parseInt(e.target.value) })}
                    style={styles.input}
                  />
                </div>
                <button type="submit" style={styles.submitBtn}>
                  Create Lecture
                </button>
              </form>
            </div>

            {/* Video Upload Form */}
            <div style={styles.builderCard}>
              <h3 style={styles.sectionHeading}>Upload Video Lecture</h3>
              <form onSubmit={handleUploadVideo} style={styles.verticalForm}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Lecture</label>
                  <select
                    value={selectedLectureId}
                    onChange={(e) => setSelectedLectureId(e.target.value)}
                    style={styles.select}
                  >
                    <option value="">-- Choose Lecture --</option>
                    {modules.flatMap(m => m.lectures || []).map((l) => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Choose Video File</label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files[0])}
                    style={styles.fileInput}
                  />
                </div>
                <button type="submit" disabled={isUploading} style={styles.submitBtn}>
                  <FiUpload /> {isUploading ? 'Uploading Video...' : 'Upload Video'}
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Course syllabus structure preview */}
          <div style={styles.syllabusPreview}>
            <div style={styles.previewHeader}>
              <h3 style={styles.sectionHeading}>Syllabus Preview</h3>
              {!selectedCourse.is_published && (
                <button onClick={handlePublishCourse} style={styles.publishBtn}>
                  Publish Course
                </button>
              )}
            </div>

            <div style={styles.previewContent}>
              {modules.length === 0 ? (
                <p style={styles.noModules}>No modules added yet. Use the sidebar to construct modules and lectures.</p>
              ) : (
                modules.map((m) => (
                  <div key={m.id} style={styles.previewModule}>
                    <div style={styles.previewModuleHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FiFolder style={styles.folderIcon} />
                        <span>{m.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => moveModule(modules.indexOf(m), 'up')} style={styles.orderBtn} title="Move Module Up">▲</button>
                        <button type="button" onClick={() => moveModule(modules.indexOf(m), 'down')} style={styles.orderBtn} title="Move Module Down">▼</button>
                      </div>
                    </div>
                    <div style={styles.previewLecturesList}>
                      {m.lectures?.map((l) => (
                        <div key={l.id} style={styles.previewLectureItem}>
                          <div style={styles.previewLecLeft}>
                            <FiPlay style={styles.playIcon} />
                            <span>{l.title}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={styles.previewLecDuration}>
                              {Math.round(l.duration_seconds / 60)} min {l.has_video && <FiCheckCircle style={styles.checkIcon} />}
                            </span>
                            <div style={{ display: 'flex', gap: '0.15rem' }}>
                              <button type="button" onClick={() => moveLecture(modules.indexOf(m), m.lectures.indexOf(l), 'up')} style={styles.orderBtnSmall} title="Move Lecture Up">▲</button>
                              <button type="button" onClick={() => moveLecture(modules.indexOf(m), m.lectures.indexOf(l), 'down')} style={styles.orderBtnSmall} title="Move Lecture Down">▼</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
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
  tabsRow: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '1px',
    marginBottom: '2.5rem',
  },
  tabBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
    cursor: 'pointer',
    border: '1px solid transparent',
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
  sectionHeading: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
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
    minHeight: '120px',
    resize: 'vertical',
  },
  btnRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
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
  },
  cancelBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '2rem',
  },
  createBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  cardTitle: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
  },
  cardDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
    flex: 1,
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  statusBadge: {
    backgroundColor: 'var(--bg-primary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-primary)',
  },
  editBtn: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '0.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textAlign: 'center',
  },
  builderLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.3fr',
    gap: '2.5rem',
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
  inlineForm: {
    display: 'flex',
    gap: '0.75rem',
  },
  iconSubmitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap',
  },
  verticalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  fileInput: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  syllabusPreview: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    height: 'fit-content',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  publishBtn: {
    backgroundColor: 'var(--color-success)',
    color: '#FFF',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.375rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    border: 'none',
  },
  previewContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  noModules: {
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
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
    gap: '0.5rem',
    fontWeight: 'var(--fw-medium)',
  },
  folderIcon: {
    color: 'var(--accent-primary)',
  },
  previewLecturesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    paddingLeft: '1.5rem',
  },
  previewLectureItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  previewLecLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  playIcon: {
    color: 'var(--text-muted)',
  },
  previewLecDuration: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  orderBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '2px 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBtnSmall: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '0.6rem',
    padding: '1px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: 'var(--color-success)',
  },
  subHeading: {
    fontSize: '1rem',
    fontWeight: 'var(--fw-semibold)',
    marginTop: '1.5rem',
    marginBottom: '0.25rem',
    color: 'var(--text-primary)',
  },
  helpText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
  },
  testCasesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1rem',
  },
  testCaseCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  testCaseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'var(--fw-medium)',
    fontSize: '0.875rem',
  },
  removeTcBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-error)',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  tcInputsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  addTcBtn: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: 'var(--fw-medium)',
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
  },
};
