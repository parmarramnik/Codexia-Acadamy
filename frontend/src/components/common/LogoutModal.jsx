import React, { useEffect } from 'react';
import { FiLogOut, FiX } from 'react-icons/fi';
import LoadingButton from './LoadingButton';

export default function LogoutModal({ isOpen, onClose, onConfirm, isLoading = false }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <div className="modal" style={{ maxWidth: '440px', padding: '1.75rem', position: 'relative' }}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close modal"
        >
          <FiX size={18} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* Warning Icon */}
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              color: 'var(--color-error)',
              opacity: 0.9,
            }}
          >
            <FiLogOut size={24} style={{ transform: 'translateX(2px)' }} />
          </div>

          <h3
            id="logout-modal-title"
            style={{
              fontSize: 'var(--fs-xl)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Confirm Sign Out
          </h3>

          <p
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              marginBottom: '1.75rem',
            }}
          >
            Are you sure you want to log out? Your current session will be terminated.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
              style={{ flex: 1, height: '42px' }}
            >
              Cancel
            </button>

            <LoadingButton
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              loading={isLoading}
              loadingText="Signing out..."
              style={{ flex: 1, height: '42px' }}
            >
              Log Out
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}
