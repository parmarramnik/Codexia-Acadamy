import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiSearch, FiChevronRight, FiClock, FiAward } from 'react-icons/fi';
import { useCourses } from '../hooks/useQueries';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import CourseCover from '../components/common/CourseCover';
import { SkeletonGrid } from '../components/common/Skeleton';

export default function Courses() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');

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

  const { data, isLoading } = useCourses({ search, category, difficulty });
  const courses = data?.items || [];

  const hasFilters = Boolean(search || category || difficulty);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog"
        title="All Courses"
        description="Explore available courses."
        actions={
          <div className="toolbar page-toolbar">
            <div className="input-with-icon toolbar-search">
              <span className="input-icon"><FiSearch size={16} /></span>
              <input
                type="search"
                className="form-input"
                placeholder="Search courses, topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search courses"
              />
            </div>

            <div className="toolbar-filters">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input form-select"
                aria-label="Filter by category"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>

              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="form-input form-select"
                aria-label="Filter by difficulty"
              >
                {difficulties.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      {/* Courses List */}
      {isLoading ? (
        <SkeletonGrid count={6} min={300} lines={3} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={FiBookOpen}
          title="No courses found"
          description={hasFilters ? 'Try adjusting your search keywords or filter settings.' : 'New courses will appear here once they are published.'}
          action={hasFilters && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setSearch(''); setCategory(''); setDifficulty(''); }}
            >
              Clear filters
            </button>
          )}
        />
      ) : (
        <>
          <p className="result-count">{courses.length} course{courses.length === 1 ? '' : 's'}</p>
          <div className="grid-auto" style={{ '--grid-min': '300px' }}>
            {courses.map((course) => (
              <Link key={course.id} to={`/courses/${course.slug}`} className="card card-interactive course-card">
                <CourseCover src={course.thumbnail_url} title={course.title} category={course.category} height={150} />
                <div className="course-card-body">
                  <div className="course-card-tags">
                    <span className="badge badge-primary">{(course.category || '').replace('_', ' ')}</span>
                    <span className="badge badge-neutral">{course.difficulty}</span>
                  </div>
                  <h3 className="course-card-title">{course.title}</h3>
                  <p className="course-card-desc">{course.short_description || 'Master modern skills with curated video lectures and exercises.'}</p>

                  <div className="course-card-meta">
                    <span><FiClock size={13} /> {course.duration_hours || 10}h</span>
                    <span><FiBookOpen size={13} /> {course.total_lectures || 0} Lectures</span>
                    <span><FiAward size={13} /> Certificate</span>
                  </div>

                  <div className="course-card-footer">
                    <span className="course-card-instructor">By {course.instructor_name || 'Codexia'}</span>
                    <span className="course-card-link">
                      View Course <FiChevronRight size={15} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
