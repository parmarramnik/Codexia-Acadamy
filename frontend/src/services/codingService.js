import api from './api';

const codingService = {
  getProblems: (params = {}) => api.get('/coding/problems', { params }),
  getProblemBySlug: (slug) => api.get(`/coding/problems/${slug}`),
  create: (data) => api.post('/coding/problems', data),
  update: (id, data) => api.put(`/coding/problems/${id}`, data),
  delete: (id) => api.delete(`/coding/problems/${id}`),
  runCode: (id, data) => api.post(`/coding/problems/${id}/run`, data),
  submitCode: (id, data) => api.post(`/coding/problems/${id}/submit`, data),
  getSubmissions: (id) => api.get(`/coding/problems/${id}/submissions`),
};

export default codingService;
