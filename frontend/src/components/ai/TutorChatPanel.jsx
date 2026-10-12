import { useCallback, useState } from 'react';
import { FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import ChatThread from './ChatThread';
import ChatComposer from './ChatComposer';
import useSpeechInput from '../../hooks/useSpeechInput';

/**
 * The conversation card used by every AI page: header (course picker, reset), thread, composer.
 * State lives in `chat` (see useTutorChat) so pages can also send prompts from their side rails.
 */
export default function TutorChatPanel({
  chat, title = 'AI Tutor Chat', subtitle, courses = [], courseId = null, onCourseChange, onReset, onOpenCanvas,
}) {
  const [draft, setDraft] = useState('');
  const appendSpeech = useCallback((text) => setDraft((prev) => (prev ? `${prev} ${text}` : text)), []);
  const speech = useSpeechInput(appendSpeech);

  const submit = () => {
    if (chat.send(draft)) setDraft('');
  };

  return (
    <section className="ai-panel" aria-label={title}>
      <header className="ai-panel-head">
        <div>
          <h2 className="ai-panel-title">{title}</h2>
          {subtitle && <span className="ai-panel-sub">{subtitle}</span>}
        </div>
        <div className="ai-panel-tools">
          {onCourseChange && (
            <select
              className="ai-select"
              value={courseId ?? ''}
              onChange={(e) => onCourseChange(e.target.value ? Number(e.target.value) : null)}
              aria-label="Answer using course material"
              title="Ground answers in one of your enrolled courses"
            >
              <option value="">General (no course)</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset} title="Clear this conversation">
            <FiTrash2 size={14} /> Reset
          </button>
        </div>
      </header>

      <ChatThread
        messages={chat.messages}
        isSending={chat.isSending}
        onRetry={chat.retry}
        onSend={chat.send}
        onOpenCanvas={onOpenCanvas}
        emptyHint={<div className="chat-empty"><FiMessageSquare size={28} /><p>Ask a question to get started.</p></div>}
      />

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        disabled={chat.isSending}
        onMic={speech.toggle}
        isListening={speech.listening}
        placeholder={courseId ? 'Ask about this course…' : 'Ask your tutor anything…'}
      />
    </section>
  );
}
