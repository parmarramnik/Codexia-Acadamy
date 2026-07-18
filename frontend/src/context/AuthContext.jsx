import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/users/me');
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password, rememberMe = false) => {
    const response = await api.post('/auth/login', { email, password, remember_me: rememberMe });
    const { access_token, refresh_token, user: userData } = response.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setUser(userData);
    setIsAuthenticated(true);

    return userData;
  };

  const loginWithTokens = (accessToken, refreshToken, userData) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(userData);
    setIsAuthenticated(true);
    return userData;
  };

  const signup = async (userData) => {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      /* logout even if server call fails */
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => ({ ...prev, ...updatedData }));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    loginWithTokens,
    signup,
    logout,
    updateUser,
    loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
