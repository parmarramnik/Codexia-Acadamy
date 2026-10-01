import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import EmptyState from './EmptyState';

/**
 * ErrorState — user-facing error with an optional retry action.
 * Technical detail is still logged by callers; this only renders a clean message.
 */
export default function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this content. Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
}) {
  return (
    <EmptyState
      icon={FiAlertTriangle}
      tone="danger"
      title={title}
      description={description}
      action={onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          <FiRefreshCw size={14} /> {retryLabel}
        </button>
      )}
    />
  );
}
