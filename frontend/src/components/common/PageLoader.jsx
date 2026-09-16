export default function PageLoader() {
  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
      role="status"
      aria-label="Loading content"
    >
      {/* Spinner */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '3px solid var(--border-primary)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <span
        style={{
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}
      >
        Loading...
      </span>
    </div>
  );
}
