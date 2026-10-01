import { FiCode } from 'react-icons/fi';

/**
 * AuthShell — shared frame for sign-in, sign-up and recovery screens.
 */
export default function AuthShell({ title, subtitle, icon: Icon = FiCode, children, footer, width = 420, standalone = false }) {
  return (
    <div className={`auth-shell ${standalone ? 'auth-shell-standalone' : ''}`}>
      <div className="auth-card" style={{ maxWidth: width }}>
        <div className="auth-header">
          <span className="auth-mark" aria-hidden="true"><Icon size={18} strokeWidth={2.4} /></span>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  );
}
