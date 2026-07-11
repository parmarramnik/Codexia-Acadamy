/**
 * Frontend utility constants and helpers.
 */

export const APP_NAME = 'Codexia';

export const ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

export const COURSE_CATEGORIES = [
  { value: 'programming', label: 'Programming' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'machine_learning', label: 'Machine Learning' },
  { value: 'artificial_intelligence', label: 'Artificial Intelligence' },
  { value: 'data_science', label: 'Data Science' },
  { value: 'dsa', label: 'DSA' },
  { value: 'cyber_security', label: 'Cyber Security' },
  { value: 'devops', label: 'DevOps' },
  { value: 'cloud', label: 'Cloud' },
];

export const DIFFICULTY_LEVELS = [
  { value: 'beginner', label: 'Beginner', color: 'var(--color-success)' },
  { value: 'intermediate', label: 'Intermediate', color: 'var(--color-warning)' },
  { value: 'advanced', label: 'Advanced', color: 'var(--color-error)' },
];

export const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
];
