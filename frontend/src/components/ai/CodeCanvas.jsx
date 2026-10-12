import { useState } from 'react';
import { FiCheck, FiCopy, FiX } from 'react-icons/fi';

/** Editable scratch pad for a code block from the conversation. */
export default function CodeCanvas({ code, language, onChange, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <aside className="ai-panel ai-canvas" aria-label="Code canvas">
      <header className="ai-panel-head">
        <div>
          <h2 className="ai-panel-title">Code canvas</h2>
          <span className="ai-panel-sub">{(language || 'text').toUpperCase()} · editable</span>
        </div>
        <div className="ai-panel-tools">
          <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
            {copied ? <FiCheck size={14} /> : <FiCopy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close canvas">
            <FiX size={14} /> Close
          </button>
        </div>
      </header>
      <textarea
        className="ai-code-input"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        spellCheck="false"
        aria-label="Code editor"
      />
    </aside>
  );
}
