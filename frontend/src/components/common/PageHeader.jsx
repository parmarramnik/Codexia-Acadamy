/**
 * PageHeader — consistent title block for every page.
 * Props: title, description, badge, icon (component), actions (node), eyebrow (string)
 */
export default function PageHeader({
  title,
  description,
  badge,
  icon: Icon,
  actions,
  eyebrow,
}) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {Icon && (
          <div className="page-header-icon" aria-hidden="true">
            <Icon />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
          <div className="page-title-row">
            <h1 className="page-title">{title}</h1>
            {badge && <span className="badge badge-primary">{badge}</span>}
          </div>
          {description && <p className="page-description">{description}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
