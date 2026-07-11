import api from './api';

const authService = {
  login: (email, password, rememberMe = false) =>
    api.post('/auth/login', { email, password, remember_me: rememberMe }),

  signup: (userData) =>
    api.post('/auth/signup', userData),

  logout: () =>
    api.post('/auth/logout'),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),

  verifyEmail: (token) =>
    api.get(`/auth/verify-email/${token}`),

  refreshToken: (refreshToken) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),

  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

export default authService;
