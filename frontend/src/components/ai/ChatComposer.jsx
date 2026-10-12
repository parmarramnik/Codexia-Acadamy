import { useEffect, useRef } from 'react';
import { FiMic, FiMicOff, FiSend } from 'react-icons/fi';

const MAX_ROWS_PX = 168;

/**
 * Message box: Enter sends, Shift+Enter inserts a newline. The textarea grows with its content
 * up to a limit, and the bar stays visible on phones (safe-area padding, no fixed positioning).
 */
export default function ChatComposer({
  value, onChange, onSubmit, disabled, placeholder = 'Ask your tutor anything…',
  onMic, isListening = false, autoFocus = false,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [value]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const submit = () => { if (!disabled && value.trim()) onSubmit(); };

  return (
    <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="chat-composer-box">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          onFocus={(e) => { setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 250); }}
          placeholder={placeholder}
          aria-label="Message"
          maxLength={5000}
        />
        {onMic && (
          <button type="button" className={`chat-icon-btn ${isListening ? 'is-active' : ''}`} onClick={onMic}
            aria-label={isListening ? 'Stop dictation' : 'Dictate message'}>
            {isListening ? <FiMicOff size={16} /> : <FiMic size={16} />}
          </button>
        )}
        <button type="submit" className="chat-send" disabled={disabled || !value.trim()} aria-label="Send message">
          <FiSend size={16} />
        </button>
      </div>
      <p className="chat-composer-hint">Enter to send · Shift+Enter for a new line</p>
    </form>
  );
}
