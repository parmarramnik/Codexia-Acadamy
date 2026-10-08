import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiClock, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import paymentService, { paymentErrorMessage } from '../services/paymentService';
import { formatMinor } from '../utils/money';
import PageLoader from '../components/common/PageLoader';

const POLL_MS = 4000;

/**
 * Payment result page. The status always comes from the backend (which reconciles with
 * Razorpay) — never from URL parameters or client state — so it is safe to refresh or
 * revisit at any time.
 */
export default function PaymentStatus() {
  const { orderId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await paymentService.getOrderStatus(orderId);
      setData(res.data);
      setError('');
      return res.data;
    } catch (err) {
      setError(paymentErrorMessage(err, 'Could not load this payment.'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const d = await load();
      const open = d && (d.status === 'CREATED' || d.status === 'PENDING' || (d.status === 'SUCCESS' && !d.enrolled));
      if (!cancelled && open) timer.current = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [load]);

  if (isLoading) return <PageLoader />;

  const courseLink = data?.course_slug ? `/courses/${data.course_slug}` : '/courses';
  let view;
  if (error) {
    view = {
      icon: <FiAlertCircle size={28} />, tone: 'danger', title: 'Payment not found',
      body: error, actions: <Link to="/courses" className="btn btn-primary">Browse courses</Link>,
    };
  } else if (data.status === 'SUCCESS' && data.enrolled) {
    view = {
      icon: <FiCheckCircle size={28} />, tone: 'success', title: 'Payment successful',
      body: `You are now enrolled in ${data.course_title || 'your course'}.`,
      actions: <Link to={courseLink} className="btn btn-primary">Start Learning</Link>,
    };
  } else if (data.status === 'FAILED') {
    view = {
      icon: <FiXCircle size={28} />, tone: 'danger', title: 'Payment could not be completed',
      body: `No course access was granted.${data.failure_reason ? ` ${data.failure_reason}` : ''}`,
      actions: <Link to={courseLink} className="btn btn-primary"><FiRefreshCw size={14} /> Try Again</Link>,
    };
  } else if (data.status === 'REFUNDED') {
    view = {
      icon: <FiRefreshCw size={28} />, tone: 'neutral', title: 'Payment refunded',
      body: 'This payment was refunded and course access has been removed.',
      actions: <Link to={courseLink} className="btn btn-secondary">View course</Link>,
    };
  } else if (data.status === 'CREATED') {
    view = {
      icon: <FiClock size={28} />, tone: 'neutral', title: 'Payment not completed',
      body: 'We have not received a payment for this order yet. If you closed the payment window, you can try again whenever you are ready.',
      actions: <Link to={courseLink} className="btn btn-primary">Back to course</Link>,
    };
  } else {
    view = {
      icon: <span className="spinner" aria-hidden="true" style={{ width: 26, height: 26 }} />, tone: 'info',
      title: 'Confirming your payment…',
      body: data.access_pending
        ? 'Your payment was received. We are activating your course access — this page updates automatically.'
        : 'Waiting for confirmation from your bank. This page updates automatically, and you can safely leave — access is granted as soon as the payment is confirmed.',
      actions: <Link to={courseLink} className="btn btn-secondary">Back to course</Link>,
    };
  }

  const toneColor = { success: 'var(--success)', danger: 'var(--danger)', info: 'var(--primary-text)', neutral: 'var(--text-muted)' }[view.tone];
  const toneBg = { success: 'var(--success-subtle)', danger: 'var(--danger-subtle)', info: 'var(--primary-subtle)', neutral: 'var(--surface-sunken)' }[view.tone];

  return (
    <div className="page" style={styles.page}>
      <div className="card card-pad" style={styles.card} role="status" aria-live="polite">
        <div style={{ ...styles.iconWrap, color: toneColor, backgroundColor: toneBg }}>{view.icon}</div>
        <h1 style={styles.title}>{view.title}</h1>
        <p style={styles.body}>{view.body}</p>

        {data && (
          <dl style={styles.details}>
            {data.course_title && (<><dt style={styles.dt}>Course</dt><dd style={styles.dd}>{data.course_title}</dd></>)}
            <dt style={styles.dt}>Amount</dt><dd style={styles.dd}>{formatMinor(data.amount, data.currency)}</dd>
            <dt style={styles.dt}>Order ID</dt><dd style={{ ...styles.dd, fontFamily: 'var(--font-mono)' }}>{data.order_id}</dd>
            {data.paid_at && (<><dt style={styles.dt}>Paid on</dt><dd style={styles.dd}>{new Date(data.paid_at + (data.paid_at.endsWith('Z') || data.paid_at.includes('+') ? '' : 'Z')).toLocaleString()}</dd></>)}
          </dl>
        )}

        <div style={styles.actions}>{view.actions}</div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', justifyContent: 'center', padding: '2rem 0' },
  card: { maxWidth: 520, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  iconWrap: { width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)', margin: 0 },
  body: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0, maxWidth: 440 },
  details: {
    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 1rem', width: '100%', textAlign: 'left',
    margin: '0.75rem 0 0', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-sunken)',
    fontSize: '0.82rem',
  },
  dt: { color: 'var(--text-muted)' },
  dd: { margin: 0, color: 'var(--text-primary)', wordBreak: 'break-all' },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' },
};
