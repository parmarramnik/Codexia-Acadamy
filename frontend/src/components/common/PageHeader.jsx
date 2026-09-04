import React from 'react';

export default function PageHeader({ 
  title, 
  description, 
  badge, 
  icon: Icon,
  actions 
}) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1.25rem',
      marginBottom: '2rem',
      paddingBottom: '1.25rem',
      borderBottom: '1px solid var(--border-primary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {Icon && (
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            fontSize: '1.35rem',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          }}>
            <Icon />
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{
              margin: 0,
              fontSize: '1.65rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}>
              {title}
            </h1>

            {badge && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {badge}
              </span>
            )}
          </div>

          {description && (
            <p style={{
              margin: '0.35rem 0 0 0',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '680px',
            }}>
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
