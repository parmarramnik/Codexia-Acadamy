import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiBookOpen, FiSearch, FiChevronRight } from 'react-icons/fi';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'programming', label: 'Programming' },
    { value: 'web_development', label: 'Web Development' },
    { value: 'machine_learning', label: 'Machine Learning' },
    { value: 'artificial_intelligence', label: 'AI' },
    { value: 'data_science', label: 'Data Science' },
    { value: 'dsa', label: 'DSA' },
    { value: 'cyber_security', label: 'Cyber Security' },
    { value: 'devops', label: 'DevOps' },
    { value: 'cloud', label: 'Cloud' }
  ];

  const difficulties = [
    { value: '', label: 'All Difficulties' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' }
  ];

  useEffect(() => {
    async function fetchCourses() {
      setIsLoading(true);
      try {
        const params = {};
        if (search) params.search = search;
        if (category) params.category = category;
        if (difficulty) params.difficulty = difficulty;

        const res = await api.get('/courses', { params });
        setCourses(res.data.items || []);
      } catch (err) {
        toast.error('Failed to fetch courses');
      } finally {
        setIsLoading(false);
      }
    }
    const delayDebounceFn = setTimeout(() => {
      fetchCourses();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, category, difficulty]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>All Courses</h1>
        <p style={styles.subtitle}>Browse structured curriculum lectures and step-by-step programming paths.</p>
      </div>

      {/* Filters Bar */}
      <div style={styles.filtersBar}>
        <div style={styles.searchWrapper}>
          <FiSearch size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.selectsWrapper}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={styles.select}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            style={styles.select}
          >
            {difficulties.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Courses List */}
      {isLoading ? (
        <div style={styles.loadingContainer}>
          <p style={styles.loadingText}>Fetching courses...</p>
        </div>
      ) : courses.length === 0 ? (
        <div style={styles.emptyState}>
          <FiBookOpen size={48} style={styles.emptyIcon} />
          <h3 style={styles.emptyTitle}>No Courses Found</h3>
          <p style={styles.emptySubtitle}>Try adjusting your search keywords or filter settings.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {courses.map((course) => (
            <div key={course.id} style={styles.card}>
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} style={styles.thumbnail} />
              ) : (
                <div style={styles.thumbnailPlaceholder}>
                  <FiBookOpen size={32} style={styles.placeholderIcon} />
                </div>
              )}
              <div style={styles.cardBody}>
                <div style={styles.tagRow}>
                  <span style={styles.categoryBadge}>{course.category.replace('_', ' ')}</span>
                  <span style={styles.difficultyBadge}>{course.difficulty}</span>
                </div>
                <h3 style={styles.courseTitle}>{course.title}</h3>
                <p style={styles.courseDesc}>{course.short_description || 'Master software development with curated lectures and quizzes.'}</p>
                <div style={styles.footerRow}>
                  <span style={styles.instructor}>By {course.instructor_name || 'Codexia'}</span>
                  <Link to={`/courses/${course.slug}`} style={styles.detailsLink}>
                    View Details <FiChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
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
  filtersBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem 1.5rem',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: '260px',
  },
  searchIcon: {
    position: 'absolute',
    left: '1rem',
    color: 'var(--text-secondary)',
  },
  searchInput: {
    width: '100%',
    padding: '0.625rem 1rem 0.625rem 2.5rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  selectsWrapper: {
    display: 'flex',
    gap: '1rem',
  },
  select: {
    padding: '0.625rem 1rem',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
    cursor: 'pointer',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  emptyState: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  emptyIcon: {
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
  },
  emptySubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all var(--transition-fast)',
  },
  thumbnail: {
    width: '100%',
    height: '180px',
    objectFit: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '180px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    color: 'var(--text-secondary)',
  },
  cardBody: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    flex: 1,
  },
  tagRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  categoryBadge: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--accent-primary)',
    border: '1px solid var(--border-primary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    textTransform: 'capitalize',
  },
  difficultyBadge: {
    fontSize: '0.75rem',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-primary)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-md)',
    textTransform: 'capitalize',
  },
  courseTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
    lineHeight: '1.3',
  },
  courseDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
    flex: 1,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.75rem',
    borderTop: '1px solid var(--border-primary)',
    paddingTop: '0.75rem',
  },
  instructor: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  detailsLink: {
    fontSize: '0.875rem',
    color: 'var(--color-link)',
    fontWeight: 'var(--fw-medium)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  }
};
