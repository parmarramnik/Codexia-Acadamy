import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiX, FiSend, FiInfo } from 'react-icons/fi';
import paymentService, { paymentErrorMessage } from '../../services/paymentService';
import { formatMinor, isPaidCourse, minorToInput, validatePriceInput } from '../../utils/money';

const STATUS_BADGE = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger' };

/**
 * Instructor price suggestion. It never changes the live price: an admin reviews it in
 * Admin Panel -> Course Pricing, and the backend re-validates everything on approval.
 */
export default function PriceRequestModal({ course, requests = [], onClose, onSubmitted }) {
  const pending = requests.find((r) => r.status === 'PENDING');
  const [form, setForm] = useState({
    pricing_type: isPaidCourse(course) ? 'PAID' : 'FREE',
    price: isPaidCourse(course) ? minorToInput(course.price_amount, course.currency) : '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const priceError = form.pricing_type === 'PAID' ? validatePriceInput(form.price) : null;

  const submit = async (e) => {
    e.preventDefault();
    if (priceError) {
      toast.error(priceError);
      return;
    }
    setSubmitting(true);
    try {
      await paymentService.submitPriceRequest({
        course_id: course.id,
        pricing_type: form.pricing_type,
        price: form.pricing_type === 'PAID' ? form.price.trim() : null,
        currency: 'INR',
        note: form.note.trim() || null,
      });
      toast.success('Price request sent for admin review');
      onSubmitted?.();
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Could not submit the price request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="price-request-title">
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 id="price-request-title" style={styles.title}>Course Pricing</h3>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        <div style={styles.current}>
          <span style={styles.muted}>Live price</span>
          <strong>{isPaidCourse(course) ? formatMinor(course.price_amount, course.currency) : 'Free'}</strong>
        </div>

        <div className="alert alert-info">
          <FiInfo size={15} />
          <span>Live prices are set by admins. Your suggestion goes live only after an admin approves it.</span>
        </div>

        {pending ? (
          <div className="alert alert-warning" role="status">
            <FiInfo size={15} />
            <span>
              Request for {pending.pricing_type === 'PAID' ? formatMinor(pending.amount, pending.currency) : 'Free'} is
              awaiting admin review. You can submit a new one after it is reviewed.
            </span>
          </div>
        ) : (
          <form onSubmit={submit} style={styles.form}>
            <div style={styles.group}>
              <span style={styles.label}>Pricing type</span>
              <div style={styles.radioRow}>
                {['FREE', 'PAID'].map((t) => (
                  <label key={t} style={styles.radio}>
                    <input
                      type="radio"
                      name="pricing_type"
                      value={t}
                      checked={form.pricing_type === t}
                      onChange={() => setForm({ ...form, pricing_type: t })}
                    />
                    {t === 'FREE' ? 'Free' : 'Paid'}
                  </label>
                ))}
              </div>
            </div>
            {form.pricing_type === 'PAID' && (
              <div style={styles.group}>
                <label htmlFor="price-request-amount" style={styles.label}>Suggested price (₹, INR)</label>
                <input
                  id="price-request-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 499"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  style={styles.input}
                  aria-invalid={Boolean(form.price && priceError)}
                />
                {form.price && priceError && <span style={styles.error}>{priceError}</span>}
              </div>
            )}
            <div style={styles.group}>
              <label htmlFor="price-request-note" style={styles.label}>Note for the admin (optional)</label>
              <textarea
                id="price-request-note"
                maxLength={1000}
                placeholder="Why this price? e.g. new labs, extra modules"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                style={styles.textarea}
              />
            </div>
            <div style={styles.btnRow}>
              <button type="submit" disabled={submitting} style={styles.submitBtn}>
                <FiSend size={14} /> {submitting ? 'Sending…' : 'Send for review'}
              </button>
              <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            </div>
          </form>
        )}

        {requests.length > 0 && (
          <div style={styles.history}>
            <span style={styles.label}>Previous requests</span>
            {requests.slice(0, 5).map((r) => (
              <div key={r.id} style={styles.historyRow}>
                <span>{r.pricing_type === 'PAID' ? formatMinor(r.amount, r.currency) : 'Free'}</span>
                <span className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`}>{r.status}</span>
                {r.review_note && <span style={styles.muted}>“{r.review_note}”</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const field = {
  padding: '0.75rem 1rem',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
};

const styles = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'var(--overlay-bg)', backdropFilter: 'blur(4px)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem',
  },
  card: {
    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)',
    width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.75rem',
  },
  title: { fontSize: '1.25rem', fontWeight: 'var(--fw-semibold)', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 },
  current: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.95rem' },
  muted: { color: 'var(--text-muted)', fontSize: '0.8rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  group: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.85rem', fontWeight: 'var(--fw-medium)', color: 'var(--text-secondary)' },
  radioRow: { display: 'flex', gap: '1.25rem' },
  radio: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' },
  input: field,
  textarea: { ...field, minHeight: '80px', resize: 'vertical' },
  error: { fontSize: '0.75rem', color: 'var(--color-error)' },
  btnRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  submitBtn: {
    backgroundColor: 'var(--primary)', color: 'var(--text-inverse)', fontWeight: 'var(--fw-semibold)',
    padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none',
  },
  cancelBtn: {
    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem', cursor: 'pointer',
  },
  history: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    borderTop: '1px solid var(--border-primary)', paddingTop: '1rem',
  },
  historyRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem' },
};
