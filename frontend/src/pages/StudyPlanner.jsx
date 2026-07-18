import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiCalendar, FiClock, FiActivity, FiPlus, FiTrash2, FiAward } from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function StudyPlanner() {
  const [plannerData, setPlannerData] = useState({
    streak_count: 0,
    reminders: [],
    course_deadlines: [],
    heatmap: [],
  });

  const [isLoading, setIsLoading] = useState(true);

  // Reminder form helper states
  const [newReminder, setNewReminder] = useState({ title: '', description: '', due_date: '' });
  
  // Study Goal helper states
  const [planForm, setPlanForm] = useState({ course_id: '', target_hours_weekly: 5, daily_goal_minutes: 30 });
  const [coursesList, setCoursesList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    async function loadPlanner() {
      try {
        const [planRes, enrollRes] = await Promise.all([
          api.get('/study-planner/calendar'),
          api.get('/courses/enrolled/me'),
        ]);
        setPlannerData(planRes.data);
        setCoursesList(enrollRes.data || []);
        if (enrollRes.data?.length > 0) {
          setPlanForm(prev => ({ ...prev, course_id: enrollRes.data[0].course.id }));
        }
      } catch (err) {
        toast.error('Failed to load planner metrics');
      } finally {
        setIsLoading(false);
      }
    }
    loadPlanner();
  }, []);

  const handleAddReminder = async (e) => {
    e.preventDefault();
    if (!newReminder.title || !newReminder.due_date) {
      return toast.error('Reminder Title and Due Date are required');
    }
    setIsAdding(true);
    try {
      const res = await api.post('/study-planner/reminders', {
        title: newReminder.title,
        description: newReminder.description,
        due_date: newReminder.due_date,
      });
      setPlannerData(prev => ({
        ...prev,
        reminders: [...prev.reminders, res.data],
      }));
      setNewReminder({ title: '', description: '', due_date: '' });
      toast.success('Reminder added to calendar!');
    } catch (err) {
      toast.error('Failed to add reminder');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDismissReminder = async (id) => {
    try {
      await api.delete(`/study-planner/reminders/${id}`);
      setPlannerData(prev => ({
        ...prev,
        reminders: prev.reminders.filter(r => r.id !== id),
      }));
      toast.success('Reminder completed / dismissed!');
    } catch (err) {
      toast.error('Failed to dismiss reminder');
    }
  };

  const handleSetGoal = async (e) => {
    e.preventDefault();
    if (!planForm.course_id) {
      return toast.error('Please select an enrolled course first');
    }
    setIsSaving(true);
    try {
      await api.post('/study-planner/plans', planForm);
      toast.success('Study Goal saved successfully!');
    } catch (err) {
      toast.error('Failed to set study goal');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate a mock contributions map helper (7 columns, 4 rows for visual overview)
  const getIntensityColor = (minutes) => {
    if (!minutes) return '#1A1A1A';
    if (minutes < 15) return '#0E3A20';
    if (minutes < 30) return '#176B37';
    if (minutes < 60) return '#20A14E';
    return '#39E75F';
  };

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Loading Study Planner Dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Study Planner & Daily Goals</h1>
      <p style={styles.pageSubtitle}>Maintain learning streaks, coordinate task deadlines, and track code performance.</p>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <FiActivity size={32} style={{ color: '#EF4444' }} />
          <div>
            <h3 style={styles.statHeading}>Daily Streak</h3>
            <p style={styles.statVal}>{plannerData.streak_count} Days</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <FiClock size={32} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3 style={styles.statHeading}>Reminders Pending</h3>
            <p style={styles.statVal}>{plannerData.reminders.length}</p>
          </div>
        </div>
      </div>

      <div style={styles.layoutGrid}>
        
        {/* Left: Heatmap and Goal Forms */}
        <div style={styles.leftColumn}>
          
          {/* Heatmap Grid */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}><FiActivity /> Activity Tracker (Last 30 Days)</h2>
            <div style={styles.heatmapBox}>
              <div style={styles.heatmapGrid}>
                {Array.from({ length: 30 }).map((_, idx) => {
                  const targetDate = new Date();
                  targetDate.setDate(targetDate.getDate() - (29 - idx));
                  const dateStr = targetDate.toISOString().split('T')[0];
                  
                  // Find match in heatmap data
                  const matchingSession = plannerData.heatmap.find(h => h.date === dateStr);
                  const minutes = matchingSession ? matchingSession.duration_minutes : 0;
                  
                  return (
                    <div 
                      key={idx} 
                      style={{
                        ...styles.heatmapCell,
                        backgroundColor: getIntensityColor(minutes),
                      }}
                      title={`${dateStr}: ${minutes} mins studied`}
                    />
                  );
                })}
              </div>
              <div style={styles.heatmapLegend}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Less</span>
                <div style={{ ...styles.heatmapCell, backgroundColor: '#1A1A1A' }} />
                <div style={{ ...styles.heatmapCell, backgroundColor: '#0E3A20' }} />
                <div style={{ ...styles.heatmapCell, backgroundColor: '#176B37' }} />
                <div style={{ ...styles.heatmapCell, backgroundColor: '#20A14E' }} />
                <div style={{ ...styles.heatmapCell, backgroundColor: '#39E75F' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>More</span>
              </div>
            </div>
          </div>

          {/* Goal Creator */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}><FiClock /> Target Learning Goals</h2>
            {coursesList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Enroll in a course to set study goals!</p>
            ) : (
              <form onSubmit={handleSetGoal} style={styles.form}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Select Course</label>
                  <select 
                    value={planForm.course_id}
                    onChange={e => setPlanForm({ ...planForm, course_id: parseInt(e.target.value) })}
                    style={styles.select}
                  >
                    {coursesList.map(e => (
                      <option key={e.course.id} value={e.course.id}>{e.course.title}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.row}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Weekly target (Hours)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100"
                      value={planForm.target_hours_weekly}
                      onChange={e => setPlanForm({ ...planForm, target_hours_weekly: parseInt(e.target.value) })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Daily target (Minutes)</label>
                    <input 
                      type="number" 
                      min="5" 
                      max="1440"
                      value={planForm.daily_goal_minutes}
                      onChange={e => setPlanForm({ ...planForm, daily_goal_minutes: parseInt(e.target.value) })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <LoadingButton type="submit" loading={isSaving} loadingText="Saving..." style={styles.submitBtn}>Save Learning Targets</LoadingButton>
              </form>
            )}
          </div>
        </div>

        {/* Right: Calendar Tasks & Deadlines */}
        <div style={styles.rightColumn}>
          
          {/* Reminders List */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}><FiCalendar /> Reminders & Deadline Tasks</h2>
            
            <form onSubmit={handleAddReminder} style={styles.reminderForm}>
              <input 
                type="text" 
                placeholder="Reminder title (e.g. Study algorithms)"
                value={newReminder.title}
                onChange={e => setNewReminder({ ...newReminder, title: e.target.value })}
                style={styles.input}
              />
              <div style={styles.row}>
                <input 
                  type="datetime-local" 
                  value={newReminder.due_date}
                  onChange={e => setNewReminder({ ...newReminder, due_date: e.target.value })}
                  style={styles.input}
                />
                <LoadingButton type="submit" loading={isAdding} loadingText="" style={styles.addReminderBtn}><FiPlus /> Add</LoadingButton>
              </div>
            </form>

            <div style={styles.remindersList}>
              {plannerData.reminders.length === 0 && plannerData.course_deadlines.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                  No upcoming deadlines or reminders!
                </p>
              ) : (
                <>
                  {/* Custom Reminders */}
                  {plannerData.reminders.map(r => (
                    <div key={r.id} style={styles.taskItem}>
                      <div>
                        <h4 style={styles.taskTitle}>{r.title}</h4>
                        <span style={styles.taskDue}>Due: {new Date(r.due_date).toLocaleString()}</span>
                      </div>
                      <button onClick={() => handleDismissReminder(r.id)} style={styles.completeBtn}>Complete</button>
                    </div>
                  ))}

                  {/* Course Deadlines */}
                  {plannerData.course_deadlines.map((c, i) => (
                    <div key={i} style={styles.courseDeadlineItem}>
                      <div>
                        <span style={styles.deadlineLabel}>Course Target</span>
                        <h4 style={styles.taskTitle}>{c.title}</h4>
                        <span style={styles.taskDue}>Target Deadline: {new Date(c.due_date).toLocaleDateString()}</span>
                      </div>
                      <span style={styles.completionBadge}>{Math.round(c.completion_percentage)}% Done</span>
                    </div>
                  ))}
                </>
              )}
            </div>
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
    color: 'var(--text-secondary)',
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
  },
  pageSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    marginBottom: '2.5rem',
  },
  statsRow: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '2.5rem',
  },
  statCard: {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1.5rem',
  },
  statHeading: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.125rem',
  },
  statVal: {
    fontSize: '1.5rem',
    fontWeight: 'var(--fw-bold)',
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '2rem',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  heatmapBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  heatmapGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '0.5rem',
  },
  heatmapCell: {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    border: '1px solid #2C2C2C',
  },
  heatmapLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginTop: '0.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    width: '100%',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  select: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.625rem',
    fontSize: '0.875rem',
  },
  input: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.625rem',
    fontSize: '0.875rem',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  reminderForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  addReminderBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0 1rem',
    cursor: 'pointer',
    fontWeight: 'var(--fw-medium)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  remindersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  taskItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '1rem',
  },
  taskTitle: {
    fontSize: '0.9rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '0.125rem',
  },
  taskDue: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  completeBtn: {
    backgroundColor: '#0F2C20',
    border: '1px solid #1C5A3E',
    color: '#34D399',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  courseDeadlineItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '1rem',
  },
  deadlineLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-bold)',
    display: 'block',
    marginBottom: '0.125rem',
  },
  completionBadge: {
    backgroundColor: '#1E3A8A',
    border: '1px solid #3B82F6',
    color: '#93C5FD',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.7rem',
    fontWeight: 'var(--fw-semibold)',
  },
};
