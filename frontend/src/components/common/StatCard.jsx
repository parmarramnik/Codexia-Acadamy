/**
 * StatCard — KPI tile. tone: neutral | primary | success | warning | danger | info
 */
export default function StatCard({ label, value, icon, tone = 'neutral', meta }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon" data-tone={tone} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <span className="stat-value">{value}</span>
      {meta && <span className="stat-meta">{meta}</span>}
    </div>
  );
}
