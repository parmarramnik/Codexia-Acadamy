import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';

const NotificationContext = createContext(null);

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  try {
    let iso = String(dateString).trim();
    // If no timezone suffix (Z or +/-offset), append Z so it is correctly parsed as UTC
    if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
      iso += 'Z';
    }
    const date = new Date(iso);
    if (isNaN(date.getTime())) return 'Just now';

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffYears = Math.floor(diffDays / 365);

    // Progression: firstly show minutes, then reach only hours, then only day, then only year
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 365) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  } catch {
    return 'Just now';
  }
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollIntervalRef = useRef(null);

  // Clear stale legacy localStorage key from previous mock data
  useEffect(() => {
    try {
      localStorage.removeItem('codexia_notifications');
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = useCallback(async (isBackground = false) => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      return;
    }

    if (!isBackground) setLoading(true);

    try {
      const res = await api.get('/analytics/notifications');
      const data = res.data || [];
      const formatted = data.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.notification_type || 'info',
        read: Boolean(n.is_read),
        link: n.link,
        created_at: n.created_at,
        time: formatRelativeTime(n.created_at),
        timestamp: new Date(n.created_at).getTime(),
      }));
      setNotifications(formatted);
    } catch (err) {
      // Silent fail on background polling, or if endpoint unavailable
      console.debug('Failed to fetch user notifications:', err?.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  // Initial fetch and automatic real-time polling (every 20s)
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchNotifications(false);

      // Start periodic background polling for true real-time updates
      pollIntervalRef.current = setInterval(() => {
        fetchNotifications(true);
      }, 20000);

      // Refresh on window focus
      const handleFocus = () => fetchNotifications(true);
      window.addEventListener('focus', handleFocus);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        window.removeEventListener('focus', handleFocus);
      };
    } else {
      setNotifications([]);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, [isAuthenticated, user?.id, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await api.patch(`/analytics/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await api.post('/analytics/notifications/read-all');
      toast.success('Marked all as read', { duration: 1500 });
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  const clearAll = useCallback(async () => {
    // Optimistic UI update
    setNotifications([]);

    try {
      await api.delete('/analytics/notifications');
      toast.success('Notifications cleared', { duration: 1500 });
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
