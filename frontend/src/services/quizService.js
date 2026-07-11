import api from './api';

const quizService = {
  getByQuizId: (id) => api.get(`/quizzes/${id}`),
  create: (courseId, data) => api.post(`/courses/${courseId}/quizzes`, data),
  update: (id, data) => api.put(`/quizzes/${id}`, data),
  delete: (id) => api.delete(`/quizzes/${id}`),
  submitAttempt: (id, data) => api.post(`/quizzes/${id}/attempt`, data),
  getLeaderboard: (id) => api.get(`/quizzes/${id}/leaderboard`),
  getAttempts: (id) => api.get(`/quizzes/${id}/attempts`),
};

export default quizService;
