import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiGithub, FiLinkedin, FiGlobe, FiBriefcase, FiCpu, FiAward, FiPlus, FiTrash2, FiFileText } from 'react-icons/fi';

export default function CareerDashboard() {
  const [portfolio, setPortfolio] = useState({
    title: '',
    bio: '',
    github_url: '',
    linkedin_url: '',
    website_url: '',
    projects: [],
    skills: [],
  });


  const [resumeText, setResumeText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form input helper states
  const [newProject, setNewProject] = useState({ name: '', description: '', url: '' });
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.get('/career/portfolio');
        setPortfolio(res.data);
      } catch (err) {
        toast.error('Failed to load career profile data');
      }
    }
    loadData();
  }, []);

  const handleUpdatePortfolio = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/career/portfolio', {
        title: portfolio.title,
        bio: portfolio.bio,
        github_url: portfolio.github_url,
        linkedin_url: portfolio.linkedin_url,
        website_url: portfolio.website_url,
        projects_json: JSON.stringify(portfolio.projects),
        skills_json: JSON.stringify(portfolio.skills),
      });
      toast.success('Career Profile updated successfully!');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const addProject = () => {
    if (!newProject.name) return toast.error('Project Name is required');
    setPortfolio(prev => ({
      ...prev,
      projects: [...prev.projects, newProject]
    }));
    setNewProject({ name: '', description: '', url: '' });
  };

  const removeProject = (index) => {
    setPortfolio(prev => ({
      ...prev,
      projects: prev.projects.filter((_, idx) => idx !== index)
    }));
  };

  const addSkill = () => {
    if (!newSkill) return;
    if (portfolio.skills.includes(newSkill)) return toast.error('Skill already exists');
    setPortfolio(prev => ({
      ...prev,
      skills: [...prev.skills, newSkill]
    }));
    setNewSkill('');
  };

  const removeSkill = (skill) => {
    setPortfolio(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const handleAnalyzeResume = async () => {
    if (!resumeText.trim()) return toast.error('Please paste your resume text first');
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await api.post('/career/resume/analyze', { resume_text: resumeText });
      setAnalysisResult(res.data);
      toast.success('Resume gap analysis completed!');
    } catch (err) {
      toast.error('Failed to analyze resume. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerFlex}>
        <div>
          <h1 style={styles.pageTitle}>Career Development & AI Portfolio</h1>
          <p style={styles.pageSubtitle}>Analyze resume skill gaps, document your projects, and show off credentials.</p>
        </div>
        <div style={styles.headerActions}>
          <a href={portfolio.github_url || '#'} target="_blank" rel="noreferrer" style={styles.actionBtnSecondary}>
            <FiGithub /> Public Portfolio
          </a>
        </div>
      </div>

      <div style={styles.layoutGrid}>
        
        {/* Left Side: Career Portfolio Details */}
        <div style={styles.leftColumn}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}><FiBriefcase style={{ color: 'var(--accent-primary)' }} /> Portfolio Details</h2>
            <form onSubmit={handleUpdatePortfolio} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Profile Headline</label>
                <input 
                  type="text" 
                  value={portfolio.title || ''} 
                  onChange={e => setPortfolio({ ...portfolio, title: e.target.value })}
                  style={styles.input} 
                  placeholder="Full-Stack Engineer / AI Specialist"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>About / Bio</label>
                <textarea 
                  value={portfolio.bio || ''} 
                  onChange={e => setPortfolio({ ...portfolio, bio: e.target.value })}
                  style={{ ...styles.input, height: '80px' }} 
                  placeholder="Share a short bio summarizing your tech stack and career aspirations..."
                />
              </div>

              <div style={styles.row}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}><FiGithub /> GitHub URL</label>
                  <input 
                    type="url" 
                    value={portfolio.github_url || ''} 
                    onChange={e => setPortfolio({ ...portfolio, github_url: e.target.value })}
                    style={styles.input} 
                    placeholder="https://github.com/..."
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}><FiLinkedin /> LinkedIn URL</label>
                  <input 
                    type="url" 
                    value={portfolio.linkedin_url || ''} 
                    onChange={e => setPortfolio({ ...portfolio, linkedin_url: e.target.value })}
                    style={styles.input} 
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}><FiGlobe /> Portfolio Website</label>
                <input 
                  type="url" 
                  value={portfolio.website_url || ''} 
                  onChange={e => setPortfolio({ ...portfolio, website_url: e.target.value })}
                  style={styles.input} 
                  placeholder="https://mywebsite.com"
                />
              </div>

              {/* Skills section */}
              <div style={styles.sectionHeader}>Skills Radar</div>
              <div style={styles.skillInputRow}>
                <input 
                  type="text" 
                  value={newSkill} 
                  onChange={e => setNewSkill(e.target.value)}
                  style={styles.input} 
                  placeholder="Add skill (e.g. React, Python, FastAPI)"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                />
                <button type="button" onClick={addSkill} style={styles.addBtn}><FiPlus /></button>
              </div>

              <div style={styles.skillsList}>
                {portfolio.skills.length === 0 ? (
                  <span style={styles.emptyLabel}>No skills added yet.</span>
                ) : (
                  portfolio.skills.map((skill, index) => (
                    <span key={index} style={styles.skillBadge}>
                      {skill}
                      <FiTrash2 onClick={() => removeSkill(skill)} style={styles.removeSkillIcon} />
                    </span>
                  ))
                )}
              </div>

              {/* Projects section */}
              <div style={styles.sectionHeader}>Projects</div>
              <div style={styles.projectFormBox}>
                <input 
                  type="text" 
                  placeholder="Project Name" 
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  style={{ ...styles.input, marginBottom: '0.5rem' }}
                />
                <input 
                  type="text" 
                  placeholder="Project Short Description" 
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  style={{ ...styles.input, marginBottom: '0.5rem' }}
                />
                <div style={styles.skillInputRow}>
                  <input 
                    type="url" 
                    placeholder="Project URL (e.g. Github)" 
                    value={newProject.url}
                    onChange={e => setNewProject({ ...newProject, url: e.target.value })}
                    style={styles.input}
                  />
                  <button type="button" onClick={addProject} style={styles.addBtn}><FiPlus /> Add</button>
                </div>
              </div>

              <div style={styles.projectsList}>
                {portfolio.projects.map((proj, idx) => (
                  <div key={idx} style={styles.projectItem}>
                    <div>
                      <h4 style={styles.projectTitle}>{proj.name}</h4>
                      <p style={styles.projectDesc}>{proj.description}</p>
                      {proj.url && <a href={proj.url} target="_blank" rel="noreferrer" style={styles.projectLink}>View Repository</a>}
                    </div>
                    <FiTrash2 onClick={() => removeProject(idx)} style={styles.deleteProjIcon} />
                  </div>
                ))}
              </div>

              <button type="submit" disabled={isSaving} style={styles.submitBtn}>
                {isSaving ? 'Saving Changes...' : 'Save Career Profile'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: AI Resume Gap Analysis & Badges */}
        <div style={styles.rightColumn}>
          
          {/* AI Resume Analyzer */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}><FiCpu style={{ color: 'var(--accent-primary)' }} /> AI Resume Gap Analyzer</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Paste your raw resume details to evaluate which topics/gaps you should improve and receive recommended academy syllabus courses.
            </p>

            <textarea 
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              style={styles.resumeArea}
              placeholder="Paste your markdown, plaintext or PDF-copied resume text here..."
            />

            <button 
              onClick={handleAnalyzeResume} 
              disabled={isAnalyzing} 
              style={styles.analyzeBtn}
            >
              {isAnalyzing ? 'Analyzing skill gaps with Codexia AI...' : 'Analyze Resume Gaps'}
            </button>

            {analysisResult && (
              <div style={styles.analysisBox}>
                <h3 style={styles.analysisSub}><FiFileText /> Extracted Skills</h3>
                <div style={styles.skillsList}>
                  {analysisResult.extracted_skills?.map((s, i) => (
                    <span key={i} style={styles.analysisBadgeGreen}>{s}</span>
                  ))}
                </div>

                <h3 style={styles.analysisSub}><FiTrash2 /> Missing Skills / Gaps</h3>
                <div style={styles.skillsList}>
                  {analysisResult.skill_gaps?.map((g, i) => (
                    <span key={i} style={styles.analysisBadgeRed}>{g}</span>
                  ))}
                </div>

                <h3 style={styles.analysisSub}><FiAward /> Recommended Courses</h3>
                <div style={styles.recsGrid}>
                  {analysisResult.recommendations?.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No direct course recommendations found.</p>
                  ) : (
                    analysisResult.recommendations?.map((course) => (
                      <div key={course.id} style={styles.recItem}>
                        <div style={styles.recHeading}>
                          <span style={styles.recCategory}>{course.category.replace('_', ' ')}</span>
                        </div>
                        <h4 style={styles.recTitle}>{course.title}</h4>
                        <Link to={`/courses/${course.slug}`} style={styles.recLink}>View Curriculum</Link>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
  headerFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
  },
  actionBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    fontSize: '0.875rem',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
  },
  pageSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
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
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    boxShadow: 'var(--shadow-md)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.75rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    width: '100%',
  },
  row: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    transition: 'border-color 0.2s ease',
  },
  sectionHeader: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--accent-primary)',
    marginTop: '1rem',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  skillInputRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  addBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.625rem 1rem',
    cursor: 'pointer',
  },
  skillsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    margin: '0.5rem 0',
  },
  skillBadge: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  removeSkillIcon: {
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
  emptyLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  projectFormBox: {
    border: '1px dashed var(--border-primary)',
    padding: '1rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-secondary)',
  },
  projectsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  projectItem: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '1rem',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectTitle: {
    fontSize: '0.95rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '0.25rem',
  },
  projectDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  projectLink: {
    fontSize: '0.75rem',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)',
  },
  deleteProjIcon: {
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  },
  submitBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem 1.5rem',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    marginTop: '1rem',
    boxShadow: 'var(--shadow-md)',
    transition: 'all 0.2s ease',
  },
  resumeArea: {
    width: '100%',
    height: '140px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: '0.875rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    lineHeight: '1.5',
    resize: 'vertical',
  },
  analyzeBtn: {
    width: '100%',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem 1.5rem',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
    boxShadow: 'var(--shadow-md)',
    transition: 'all 0.2s ease',
  },
  analysisBox: {
    border: '1px solid var(--border-primary)',
    padding: '1.5rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
  },
  analysisSub: {
    fontSize: '0.9rem',
    fontWeight: 'var(--fw-semibold)',
    margin: '1.25rem 0 0.5rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  analysisBadgeGreen: {
    backgroundColor: '#0F2C20',
    border: '1px solid #1C5A3E',
    color: '#34D399',
    borderRadius: 'var(--radius-sm)',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
  },
  analysisBadgeRed: {
    backgroundColor: '#35161A',
    border: '1px solid #6A2128',
    color: '#F87171',
    borderRadius: 'var(--radius-sm)',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
  },
  recsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  recItem: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    padding: '1rem',
    borderRadius: 'var(--radius-sm)',
  },
  recHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.25rem',
  },
  recCategory: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-bold)',
  },
  recTitle: {
    fontSize: '0.9rem',
    fontWeight: 'var(--fw-medium)',
    marginBottom: '0.5rem',
  },
  recLink: {
    fontSize: '0.8rem',
    color: 'var(--accent-primary)',
    fontWeight: 'var(--fw-semibold)',
  },
};
