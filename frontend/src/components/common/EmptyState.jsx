/**
 * EmptyState — friendly placeholder when a list or view has no content.
 */
export default function EmptyState({ icon: Icon, title, description, action, plain = false, tone, style }) {
  return (
    <div className={`empty-state ${plain ? 'empty-state-plain' : ''}`} data-tone={tone} style={style}>
      {Icon && (
        <div className="empty-state-icon" aria-hidden="true">
          <Icon />
        </div>
      )}
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-text">{description}</p>}
      {action && <div className="empty-state-actions">{action}</div>}
    </div>
  );
}
