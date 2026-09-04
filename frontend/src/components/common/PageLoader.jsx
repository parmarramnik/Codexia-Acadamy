import React from 'react';

export default function PageLoader() {
  return (
    <div style={{
      minHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.85rem',
    }}>
      {/* Clean minimal spinner */}
      <div style={{
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        border: '2.5px solid rgba(255, 255, 255, 0.12)',
        borderTopColor: '#6366F1',
        animation: 'spin 0.75s linear infinite',
      }} />

      <span style={{
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
        fontWeight: 500,
      }}>
        Loading...
      </span>
    </div>
  );
}
