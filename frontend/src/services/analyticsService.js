import api from './api';

const analyticsService = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getStudySessions: (params = {}) => api.get('/analytics/sessions', { params }),
  getWeeklyProgress: () => api.get('/analytics/weekly'),
  getStrengths: () => api.get('/analytics/strengths'),
  getNotes: (params = {}) => api.get('/notes', { params }),
  createNote: (data) => api.post('/notes', data),
  updateNote: (id, data) => api.put(`/notes/${id}`, data),
  deleteNote: (id) => api.delete(`/notes/${id}`),
  getFlashcards: (params = {}) => api.get('/flashcards', { params }),
  createFlashcard: (data) => api.post('/flashcards', data),
  updateFlashcard: (id, data) => api.patch(`/flashcards/${id}`, data),
  deleteFlashcard: (id) => api.delete(`/flashcards/${id}`),
  getCertificates: () => api.get('/certificates'),
  verifyCertificate: (uid) => api.get(`/certificates/${uid}/verify`),
  getNotifications: () => api.get('/notifications'),
  markNotificationRead: (id) => api.patch(`/notifications/${id}/read`),
};

export default analyticsService;
