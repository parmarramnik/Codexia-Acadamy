import api from './api';

const courseService = {
  getAll: (params = {}) => api.get('/courses', { params }),
  getBySlug: (slug) => api.get(`/courses/${slug}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),
  approve: (id) => api.patch(`/courses/${id}/approve`),
  enroll: (id) => api.post(`/courses/${id}/enroll`),
  getModules: (courseId) => api.get(`/courses/${courseId}/modules`),
  createModule: (courseId, data) => api.post(`/courses/${courseId}/modules`, data),
  updateModule: (moduleId, data) => api.put(`/modules/${moduleId}`, data),
  deleteModule: (moduleId) => api.delete(`/modules/${moduleId}`),
  createLecture: (moduleId, data) => api.post(`/modules/${moduleId}/lectures`, data),
  updateLecture: (lectureId, data) => api.put(`/lectures/${lectureId}`, data),
  deleteLecture: (lectureId) => api.delete(`/lectures/${lectureId}`),
  uploadVideo: (lectureId, formData) =>
    api.post(`/lectures/${lectureId}/video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateProgress: (lectureId, data) => api.patch(`/lectures/${lectureId}/progress`, data),
  uploadThumbnail: (courseId, formData) =>
    api.post(`/courses/${courseId}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export default courseService;
