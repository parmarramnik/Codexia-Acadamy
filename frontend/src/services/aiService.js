import api from './api';

const aiService = {
  chat: (data) => api.post('/ai/chat', data),
  generateNotes: (data) => api.post('/ai/generate/notes', data),
  generateFlashcards: (data) => api.post('/ai/generate/flashcards', data),
  generateQuiz: (data) => api.post('/ai/generate/quiz', data),
  debugCode: (data) => api.post('/ai/debug', data),
  recommend: (data) => api.post('/ai/recommend', data),
};

export default aiService;
