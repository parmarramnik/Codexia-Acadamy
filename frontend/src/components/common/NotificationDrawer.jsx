import React, { useState, useRef, useEffect } from 'react';
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
        return <FiAward style={{ color: 'var(--color-warning)' }} />;
      case 'quiz_result':
        return <FiAward style={{ color: 'var(--color-info)' }} />;
      case 'security':
        return <FiShield style={{ color: 'var(--color-success)' }} />;
      case 'assignment':
        return <FiCalendar style={{ color: 'var(--color-info)' }} />;
      case 'course':
      case 'course_update':
        return <FiBookOpen style={{ color: 'var(--accent-primary)' }} />;
      case 'success':
        return <FiCheck style={{ color: 'var(--color-success)' }} />;
      default:
        return <FiBell style={{ color: 'var(--accent-primary)' }} />;
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
    <div
      ref={drawerRef}
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'absolute',
        top: '56px',
        right: '0',
        width: '380px',
        maxWidth: '92vw',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        zIndex: 'var(--z-dropdown)',
        overflow: 'hidden',
        animation: 'slideDown 0.15s ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.9rem 1.15rem',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiBell size={18} style={{ color: 'var(--accent-primary)' }} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Notifications
          </h4>
          {unreadCount > 0 && (
            <span style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '9999px',
            }}>
              {unreadCount} new
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              title="Mark all as read"
              aria-label="Mark all notifications as read"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <FiCheck size={14} /> Mark Read
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <FiX size={16} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        padding: '0.5rem 1.25rem',
        gap: '0.5rem',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-secondary)',
      }}>
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent-light)' : 'transparent',
              color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
          >
            {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{
            padding: '2.5rem 1.25rem',
            textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              No notifications yet.
            </p>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'block' }}>
              Updates will appear when you enroll in courses, solve problems, or complete quizzes.
            </span>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border-secondary)',
                backgroundColor: notif.read ? 'transparent' : 'var(--accent-light)',
                cursor: 'pointer',
                display: 'flex',
                gap: '0.75rem',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : 'var(--accent-light)')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(notif); }}
            >
              {/* Icon */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}>
                {getIcon(notif.type)}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: notif.read ? 500 : 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {notif.title}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
                    {formatRelativeTime(notif.created_at) || notif.time}
                  </span>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                }}>
                  {notif.message}
                </p>
              </div>

              {/* Unread Dot */}
              {!notif.read && (
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  flexShrink: 0,
                  alignSelf: 'center',
                }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div style={{
          padding: '0.6rem 1.25rem',
          borderTop: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-tertiary)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={clearAll}
            aria-label="Clear all notifications"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <FiTrash2 size={12} /> Clear all
          </button>
        </div>
      )}
    </div>
  );
}
