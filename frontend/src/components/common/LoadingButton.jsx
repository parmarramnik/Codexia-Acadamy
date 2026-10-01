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
    opacity: loading ? 0.85 : (disabled ? 0.5 : 1),
  };

  return (
    <button
      className={`loading-btn ${className}`}
      style={mergedStyle}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          className="spinner"
          aria-hidden="true"
          style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'currentColor', borderTopColor: 'transparent', opacity: 0.9 }}
        />
      )}
      {loading ? loadingText : children}
    </button>
  );
}
