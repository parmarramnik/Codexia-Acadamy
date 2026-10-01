import { useEffect } from 'react';
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
      aria-describedby="logout-modal-desc"
    >
      <div className="modal modal-sm">
        <button
          type="button"
          className="btn-icon btn-sm modal-close"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close modal"
        >
          <FiX size={16} />
        </button>

        <div className="modal-body" style={{ paddingTop: '1.75rem' }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <FiLogOut size={20} />
          </div>
          <h3 id="logout-modal-title" className="modal-title">Sign out of Codexia?</h3>
          <p id="logout-modal-desc" className="modal-description">
            Your current session will end on this device. You can sign back in at any time.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
            autoFocus
          >
            Cancel
          </button>
          <LoadingButton
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            loading={isLoading}
            loadingText="Signing out..."
          >
            Sign out
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
