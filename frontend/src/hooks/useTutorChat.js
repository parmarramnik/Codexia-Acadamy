import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';

let nextId = 1;
const makeId = () => `m${nextId++}`;

/** Turn an axios error into a short message a student can act on. */
export function describeApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (!err?.response) return 'Could not reach the server. Check your connection and try again.';
  const detail = err.response.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (err.response.status === 429) return 'Too many requests. Please wait a moment and try again.';
  return fallback;
}

/**
 * Tutor conversation state shared by the AI pages.
 * Messages: { id, role: 'user'|'assistant'|'error', content, sources?, grounded?, truncated?, retryText? }
 */
export default function useTutorChat({ greeting, courseId = null }) {
  const makeGreeting = useCallback(() => (greeting ? [{ id: makeId(), role: 'assistant', content: greeting, greeting: true }] : []), [greeting]);
  const [messages, setMessages] = useState(makeGreeting);
  const [isSending, setIsSending] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const sessionRef = useRef(null);
  const inFlight = useRef(false);

  const request = useCallback(async (text) => {
    if (inFlight.current) return; // a second click/Enter while a request is running does nothing
    inFlight.current = true;
    setIsSending(true);
    try {
      const body = { message: text, session_id: sessionRef.current };
      if (courseId) body.course_id = courseId;
      const res = await api.post('/ai/chat', body, { timeout: 90000 });
      if (res.data.session_id) sessionRef.current = res.data.session_id;
      setMessages((prev) => [...prev, {
        id: makeId(),
        role: 'assistant',
        content: res.data.response,
        sources: res.data.sources || [],
        grounded: Boolean(res.data.grounded),
        truncated: Boolean(res.data.truncated),
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: makeId(), role: 'error', content: describeApiError(err), retryText: text }]);
    } finally {
      inFlight.current = false;
      setIsSending(false);
    }
  }, [courseId]);

  const send = useCallback((raw) => {
    const text = (raw || '').trim();
    if (!text || inFlight.current) return false;
    setMessages((prev) => [...prev, { id: makeId(), role: 'user', content: text }]);
    request(text);
    return true;
  }, [request]);

  const retry = useCallback((errorId) => {
    const failed = messagesRef.current.find((m) => m.id === errorId);
    if (!failed?.retryText || inFlight.current) return;
    setMessages((prev) => prev.filter((m) => m.id !== errorId));
    request(failed.retryText);
  }, [request]);

  const reset = useCallback((message) => {
    sessionRef.current = null;
    setMessages(message ? [{ id: makeId(), role: 'assistant', content: message, greeting: true }] : makeGreeting());
  }, [makeGreeting]);

  // A different course is a different context: start a fresh session for it.
  const lastCourse = useRef(courseId);
  useEffect(() => {
    if (lastCourse.current !== courseId) {
      lastCourse.current = courseId;
      sessionRef.current = null;
    }
  }, [courseId]);

  return { messages, isSending, send, retry, reset };
}
