/**
 * Skeleton — shimmer placeholder blocks used while content loads.
 */
export default function Skeleton({ width = '100%', height = 14, radius, style, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      aria-hidden="true"
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonCard({ lines = 3, height }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: height }}>
      <Skeleton width="45%" height={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6, min = 280, lines = 3 }) {
  return (
    <div className="grid-auto" style={{ '--grid-min': `${min}px` }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={lines} />)}
    </div>
  );
}
