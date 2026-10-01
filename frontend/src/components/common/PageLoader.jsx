import Skeleton from './Skeleton';

/**
 * PageLoader — skeleton page shown while a route or its data loads.
 */
export default function PageLoader() {
  return (
    <div
      className="page"
      role="status"
      aria-live="polite"
      aria-label="Loading content"
      style={{ animation: 'fadeIn 0.3s ease', padding: '0.5rem 0' }}
    >
      <span className="sr-only">Loading…</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={220} height={26} radius={8} />
        <Skeleton width="min(420px, 80%)" height={14} />
      </div>
      <div className="grid-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <Skeleton width="50%" height={12} />
            <Skeleton width="35%" height={26} radius={6} />
          </div>
        ))}
      </div>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Skeleton width="30%" height={16} />
        <Skeleton height={12} />
        <Skeleton height={12} />
        <Skeleton width="65%" height={12} />
      </div>
    </div>
  );
}
