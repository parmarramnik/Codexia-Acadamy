import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, formatRelativeTime } from '../../context/NotificationContext';
import { 
  FiBell, FiCheck, FiTrash2, FiBookOpen, 
  FiAward, FiShield, FiCalendar, FiExternalLink, FiX 
} from 'react-icons/fi';

export default function NotificationDrawer({ isOpen, onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const drawerRef = useRef(null);
  const navigate = useNavigate();

  // Close when clicking outside
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
        return <FiAward style={{ color: '#F59E0B' }} />;
      case 'quiz_result':
        return <FiAward style={{ color: '#38BDF8' }} />;
      case 'security':
        return <FiShield style={{ color: '#10B981' }} />;
      case 'assignment':
        return <FiCalendar style={{ color: '#38BDF8' }} />;
      case 'course':
      case 'course_update':
        return <FiBookOpen style={{ color: '#818CF8' }} />;
      case 'success':
        return <FiCheck style={{ color: '#10B981' }} />;
      default:
        return <FiBell style={{ color: '#818CF8' }} />;
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
      style={{
        position: 'absolute',
        top: '56px',
        right: '0',
        width: '380px',
        maxWidth: '92vw',
        backgroundColor: 'var(--bg-card, #1D222E)',
        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
        borderRadius: '14px',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.9rem 1.15rem',
        borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary, #171B24)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiBell size={18} style={{ color: '#6366F1' }} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>
            Notifications
          </h4>
          {unreadCount > 0 && (
            <span style={{
              backgroundColor: '#6366F1',
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
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              <FiCheck size={14} /> Mark Read
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '4px',
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
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            background: filter === 'all' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
            color: filter === 'all' ? '#818CF8' : '#94A3B8',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          style={{
            background: filter === 'unread' ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
            color: filter === 'unread' ? '#818CF8' : '#94A3B8',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{
            padding: '2.5rem 1.25rem',
            textAlign: 'center',
            color: '#64748B',
            fontSize: '0.85rem',
          }}>
            <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', color: '#94A3B8', fontWeight: 500 }}>
              No notifications yet.
            </p>
            <span style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: '1.4', display: 'block' }}>
              Real-time updates will appear when you enroll in courses, solve problems, or complete quizzes.
            </span>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                backgroundColor: notif.read ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                cursor: 'pointer',
                display: 'flex',
                gap: '0.75rem',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : 'rgba(99, 102, 241, 0.06)')}
            >
              {/* Type Icon Badge */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}>
                {getIcon(notif.type)}
              </div>

              {/* Text Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: notif.read ? 500 : 700,
                    color: notif.read ? '#E2E8F0' : '#FFFFFF',
                  }}>
                    {notif.title}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                    {formatRelativeTime(notif.created_at) || notif.time}
                  </span>
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  color: '#94A3B8',
                  lineHeight: '1.4',
                }}>
                  {notif.message}
                </p>
              </div>

              {/* Unread Dot Indicator */}
              {!notif.read && (
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#6366F1',
                  flexShrink: 0,
                  alignSelf: 'center',
                  boxShadow: '0 0 6px #6366F1',
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
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={clearAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FiTrash2 size={12} /> Clear all
          </button>
        </div>
      )}
    </div>
  );
}
