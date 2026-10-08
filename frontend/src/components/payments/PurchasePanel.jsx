import { Link } from 'react-router-dom';
import { FiAlertCircle, FiInfo, FiLock, FiRefreshCw, FiShoppingCart, FiXCircle } from 'react-icons/fi';
import LoadingButton from '../common/LoadingButton';
import { formatMinor } from '../../utils/money';

const LOADING_TEXT = {
  creating: 'Starting secure checkout…',
  checkout: 'Complete payment in the Razorpay window…',
  verifying: 'Processing payment…',
};

/**
 * Buy area for a paid course the learner does not own yet. All states come from
 * useCoursePurchase; success is rendered by the enrolled view once the backend confirms.
 */
export default function PurchasePanel({ course, phase, message, orderId, onBuy, canPurchase, blockedReason }) {
  const price = formatMinor(course.price_amount, course.currency);
  const busy = phase in LOADING_TEXT;

  if (!course.is_purchasable) {
    return (
      <div className="alert alert-warning" role="status">
        <FiLock size={15} />
        <span>Enrollment for this course is currently closed. Please check back later.</span>
      </div>
    );
  }

  if (!canPurchase) {
    return (
      <div className="alert alert-info" role="status">
        <FiInfo size={15} />
        <span>{blockedReason}</span>
      </div>
    );
  }

  if (phase === 'pending') {
    return (
      <div style={styles.stack}>
        <div className="alert alert-info" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" style={styles.spinner} />
          <span>{message || 'Confirming your payment…'}</span>
        </div>
        {orderId && (
          <Link to={`/payments/${orderId}`} className="btn btn-secondary btn-block">
            View payment status
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={styles.stack}>
      {phase === 'failed' && (
        <div className="alert alert-error" role="alert">
          <FiXCircle size={15} />
          <div>
            <strong style={styles.alertTitle}>Payment could not be completed.</strong>
            <div>No course access was granted.{message ? ` ${message}` : ''}</div>
          </div>
        </div>
      )}
      {phase === 'cancelled' && (
        <div className="alert alert-warning" role="status">
          <FiAlertCircle size={15} />
          <div>
            <strong style={styles.alertTitle}>Payment cancelled.</strong>
            <div>You can try again whenever you're ready.</div>
          </div>
        </div>
      )}

      <LoadingButton
        onClick={onBuy}
        loading={busy}
        loadingText={LOADING_TEXT[phase]}
        className="btn btn-primary btn-lg btn-block"
      >
        {phase === 'failed'
          ? <><FiRefreshCw size={16} /> Try Again</>
          : <><FiShoppingCart size={16} /> Buy Now · {price}</>}
      </LoadingButton>
      <p style={styles.secureNote}>
        <FiLock size={12} /> Secure payment via Razorpay · UPI, cards, netbanking & wallets
      </p>
    </div>
  );
}

const styles = {
  stack: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  alertTitle: { display: 'block', fontWeight: 'var(--fw-semibold)', marginBottom: 2 },
  spinner: { width: 14, height: 14, borderWidth: 2, marginTop: 3, flexShrink: 0 },
  secureNote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
    fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, textAlign: 'center',
  },
};
