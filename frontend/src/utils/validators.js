/**
 * Frontend validation utilities.
 */

export function validateEmail(email) {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

export function validatePassword(password) {
  const errors = [];
  if (password.length < 6) errors.push('Password must be at least 6 characters');
  return errors;
}

export function validateUsername(username) {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Only letters, numbers, underscores, and hyphens';
  return null;
}
