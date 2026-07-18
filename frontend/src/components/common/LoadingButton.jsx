import { FiLoader } from 'react-icons/fi';

/**
 * LoadingButton — A reusable button that shows a spinner + loading text
 * during async operations.
 *
 * Props:
 *   loading     — boolean, shows spinner when true
 *   loadingText — string, text shown during loading (default: "Processing...")
 *   children    — default button content
 *   disabled    — additional disabled state
 *   style       — inline style object
 *   className   — CSS class name
 *   ...rest     — all other native <button> props (onClick, type, etc.)
 */
export default function LoadingButton({
  loading = false,
  loadingText = 'Processing...',
  children,
  disabled,
  style = {},
  className = '',
  ...rest
}) {
  const isDisabled = loading || disabled;

  const mergedStyle = {
    ...style,
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.8 : (disabled ? 0.5 : 1),
    transition: 'opacity 0.2s ease',
  };

  return (
    <button
      className={`loading-btn ${className}`}
      style={mergedStyle}
      disabled={isDisabled}
      {...rest}
    >
      {loading && (
        <span className="loading-btn-spinner" aria-hidden="true">
          <FiLoader size={16} />
        </span>
      )}
      {loading ? loadingText : children}
    </button>
  );
}
