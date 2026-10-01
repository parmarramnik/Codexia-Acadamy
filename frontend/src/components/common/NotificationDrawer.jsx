import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, formatRelativeTime } from '../../context/NotificationContext';
import {
  FiBell, FiCheck, FiTrash2, FiBookOpen,
  FiAward, FiShield, FiCalendar, FiX
} from 'react-icons/fi';

export default function NotificationDrawer({ isOpen, onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState('all');
  const drawerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) =>
    filter === 'unread' ? !n.read : true
  );

  const getIcon = (type) => {
    switch (type) {
      case 'achievement':
        return { icon: <FiAward />, tone: 'warning' };
      case 'quiz_result':
        return { icon: <FiAward />, tone: 'info' };
      case 'security':
        return { icon: <FiShield />, tone: 'success' };
      case 'assignment':
        return { icon: <FiCalendar />, tone: 'info' };
      case 'course':
      case 'course_update':
        return { icon: <FiBookOpen />, tone: 'primary' };
      case 'success':
        return { icon: <FiCheck />, tone: 'success' };
      default:
        return { icon: <FiBell />, tone: 'primary' };
    }
  };

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);
    onClose();
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div ref={drawerRef} role="dialog" aria-label="Notifications" className="notif-panel popover">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-title">
          <h4>Notifications</h4>
          {unreadCount > 0 && <span className="badge badge-primary">{unreadCount} new</span>}
        </div>
        <div className="notif-header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={markAllAsRead}
              title="Mark all as read"
              aria-label="Mark all notifications as read"
            >
              <FiCheck size={14} /> Mark all read
            </button>
          )}
          <button type="button" className="btn-icon btn-sm" onClick={onClose} aria-label="Close notifications">
            <FiX size={16} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notif-filters">
        <div className="segmented" role="tablist">
          {['all', 'unread'].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      <div className="notif-list">
        {filteredNotifications.length === 0 ? (
          <div className="notif-empty">
            <div className="empty-state-icon" aria-hidden="true"><FiBell /></div>
            <p className="empty-state-title">You’re all caught up</p>
            <span className="empty-state-text">
              Updates will appear when you enroll in courses, solve problems, or complete quizzes.
            </span>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const { icon, tone } = getIcon(notif.type);
            return (
              <div
                key={notif.id}
                className={`notif-item ${notif.read ? '' : 'unread'}`}
                onClick={() => handleNotificationClick(notif)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(notif); }}
              >
                <span className="stat-icon" data-tone={tone} aria-hidden="true">{icon}</span>
                <div className="notif-item-body">
                  <div className="notif-item-top">
                    <span className="notif-item-title">{notif.title}</span>
                    <span className="notif-item-time">
                      {formatRelativeTime(notif.created_at) || notif.time}
                    </span>
                  </div>
                  <p className="notif-item-message">{notif.message}</p>
                </div>
                {!notif.read && <span className="notif-unread-dot" aria-label="Unread" />}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="notif-footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll} aria-label="Clear all notifications">
            <FiTrash2 size={13} /> Clear all
          </button>
        </div>
      )}
    </div>
  );
}
