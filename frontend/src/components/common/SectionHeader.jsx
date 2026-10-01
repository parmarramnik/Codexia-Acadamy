/**
 * SectionHeader — heading for a block of content within a page.
 */
export default function SectionHeader({ title, description, action, as: Tag = 'h2' }) {
  return (
    <div className="section-header">
      <div style={{ minWidth: 0 }}>
        <Tag className="section-title">{title}</Tag>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
