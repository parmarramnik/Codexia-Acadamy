import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiArrowDown, FiBookOpen, FiCheck, FiCopy, FiCpu, FiRefreshCw, FiUser } from 'react-icons/fi';
import MarkdownContent from '../common/MarkdownContent';

const NEAR_BOTTOM_PX = 120;

function SourceList({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="chat-sources" aria-label="Course sources">
      <span className="chat-sources-label"><FiBookOpen size={13} /> Course sources</span>
      <ul>
        {sources.map((s) => (
          <li key={`${s.document_id}-${s.id}`} className={s.cited ? 'is-cited' : ''}
            title={s.cited ? 'Cited in the answer' : 'Retrieved but not cited'}>
            <span className="chat-source-id">S{s.id}</span>
            <span className="chat-source-title">{s.title}{s.section ? ` — ${s.section}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantMessage({ message, onOpenCanvas, onContinue, isLast, isSending }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable: nothing to do */ }
  };
  return (
    <article className="chat-row chat-row-assistant">
      <div className="chat-avatar" aria-hidden="true"><FiCpu size={16} /></div>
      <div className="chat-body">
        <header className="chat-meta">
          <span className="chat-author">AI Tutor</span>
          {message.grounded && <span className="badge badge-primary">From your course</span>}
          {!message.greeting && (
            <button type="button" className="chat-icon-btn" onClick={copy} aria-label="Copy answer">
              {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
            </button>
          )}
        </header>
        <MarkdownContent content={message.content} onOpenCanvas={onOpenCanvas} />
        <SourceList sources={message.sources} />
        {message.truncated && (
          <div className="chat-notice">
            <FiAlertTriangle size={14} />
            <span>This answer was cut off.</span>
            {isLast && (
              <button type="button" className="chat-link-btn" disabled={isSending} onClick={() => onContinue('Please continue from where you stopped.')}>
                Continue
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Scrollable conversation. Auto-scroll follows new messages only while the reader is already
 * near the bottom (so scrolling up to re-read is never fought), and a button jumps back down.
 */
export default function ChatThread({ messages, isSending, onRetry, onSend, onOpenCanvas, emptyHint }) {
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = near;
    setShowJump(!near);
  };

  const last = messages[messages.length - 1];
  useLayoutEffect(() => {
    // The student's own message always scrolls into view; answers only follow if they were reading the end.
    if (last?.role === 'user' || stickRef.current) scrollToBottom(true);
  }, [messages.length, isSending, last?.role, scrollToBottom]);

  useEffect(() => { scrollToBottom(false); }, [scrollToBottom]);

  return (
    <div className="chat-scroll" ref={scrollRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
      <div className="chat-column">
        {messages.length === 0 && emptyHint}
        {messages.map((m, index) => {
          if (m.role === 'user') {
            return (
              <article key={m.id} className="chat-row chat-row-user">
                <div className="chat-bubble-user">{m.content}</div>
                <div className="chat-avatar chat-avatar-user" aria-hidden="true"><FiUser size={16} /></div>
              </article>
            );
          }
          if (m.role === 'error') {
            return (
              <div key={m.id} className="chat-error" role="alert">
                <FiAlertTriangle size={16} />
                <div className="chat-error-text">
                  <strong>The tutor couldn’t answer.</strong>
                  <span>{m.content}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRetry(m.id)} disabled={isSending}>
                  <FiRefreshCw size={13} /> Retry
                </button>
              </div>
            );
          }
          return (
            <AssistantMessage key={m.id} message={m} onOpenCanvas={onOpenCanvas} onContinue={onSend}
              isLast={index === messages.length - 1} isSending={isSending} />
          );
        })}
        {isSending && (
          <div className="chat-row chat-row-assistant" aria-label="The tutor is thinking">
            <div className="chat-avatar" aria-hidden="true"><FiCpu size={16} /></div>
            <div className="chat-body"><div className="chat-typing"><span /><span /><span /></div></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {showJump && (
        <button type="button" className="chat-jump" onClick={() => { stickRef.current = true; scrollToBottom(true); }}>
          <FiArrowDown size={14} /> Latest
        </button>
      )}
    </div>
  );
}
