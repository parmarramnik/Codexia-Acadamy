import { useCallback, useEffect, useRef, useState } from 'react';
import paymentService, { paymentErrorCode, paymentErrorMessage } from '../services/paymentService';
import { openRazorpayCheckout } from '../utils/razorpay';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // ~1 minute, then we hand off to the status page / webhook

/**
 * Paid-course purchase state machine.
 *
 *   idle -> creating -> checkout -> verifying -> success
 *                          |            |-> pending (polls backend) -> success | failed
 *                          |-> cancelled | failed
 *
 * "success" is only ever set from a backend response — never from the Razorpay callback alone.
 */
export default function useCoursePurchase({ course, onEnrolled }) {
  const [phase, setPhase] = useState('idle');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);
  const busyRef = useRef(false);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);
  const onEnrolledRef = useRef(onEnrolled);
  onEnrolledRef.current = onEnrolled;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(pollRef.current);
    };
  }, []);

  const applyStatus = useCallback((data) => {
    if (!mountedRef.current || !data) return 'unknown';
    if (data.status === 'SUCCESS' && data.enrolled) {
      setPhase('success');
      setMessage('');
      onEnrolledRef.current?.();
      return 'done';
    }
    if (data.status === 'SUCCESS') {
      setPhase('pending');
      setMessage('Payment received. We are activating your course access…');
      return 'wait';
    }
    if (data.status === 'FAILED') {
      setPhase('failed');
      setMessage(data.failure_reason || 'Payment could not be completed.');
      return 'done';
    }
    if (data.status === 'REFUNDED') {
      setPhase('failed');
      setMessage('This payment was refunded.');
      return 'done';
    }
    setPhase('pending');
    setMessage('Confirming your payment with the bank…');
    return 'wait';
  }, []);

  const pollStatus = useCallback((id, attempt = 0) => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const { data } = await paymentService.getOrderStatus(id);
        if (applyStatus(data) === 'done') return;
      } catch {
        /* transient — keep polling */
      }
      if (attempt + 1 < POLL_MAX_ATTEMPTS) {
        pollStatus(id, attempt + 1);
      } else if (mountedRef.current) {
        setPhase('pending');
        setMessage('Still confirming your payment. You can safely leave this page — access is granted automatically once your bank confirms.');
      }
    }, POLL_INTERVAL_MS);
  }, [applyStatus]);

  const buy = useCallback(async () => {
    if (busyRef.current || !course) return;
    busyRef.current = true;
    clearTimeout(pollRef.current);
    setPhase('creating');
    setMessage('');
    try {
      const { data: order } = await paymentService.createOrder(course.id);
      if (!mountedRef.current) return;
      setOrderId(order.order_id);
      setPhase('checkout');

      const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      const result = await openRazorpayCheckout({
        order,
        name: 'Codexia Academy',
        description: course.title,
        themeColor: /^#[0-9a-f]{6}$/i.test(themeColor) ? themeColor : undefined,
      });
      if (!mountedRef.current) return;

      if (result.type === 'dismissed') {
        // A payment can complete just as the modal closes — ask the backend before saying "cancelled".
        let st = null;
        try {
          st = (await paymentService.getOrderStatus(order.order_id)).data;
        } catch { /* ignore */ }
        if (st && (st.status === 'SUCCESS' || st.status === 'PENDING')) {
          if (applyStatus(st) === 'wait') pollStatus(order.order_id);
          return;
        }
        if (result.failure) {
          setPhase('failed');
          setMessage(result.failure.description || 'Payment could not be completed.');
        } else {
          setPhase('cancelled');
          setMessage('');
        }
        return;
      }

      setPhase('verifying');
      try {
        const { data } = await paymentService.verify(result.response);
        if (applyStatus(data) === 'wait') pollStatus(order.order_id);
      } catch (err) {
        if (!err?.response || err.response.status >= 500) {
          // Network/server hiccup after paying: the backend (webhook + reconcile) is the source of truth.
          setPhase('pending');
          setMessage('Confirming your payment…');
          pollStatus(order.order_id);
        } else {
          setPhase('failed');
          setMessage(paymentErrorMessage(err, 'Payment verification failed.'));
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const code = paymentErrorCode(err);
      if (code === 'ALREADY_ENROLLED') {
        setPhase('success');
        onEnrolledRef.current?.();
        return;
      }
      setPhase(code === 'PAYMENT_IN_PROGRESS' ? 'pending' : 'failed');
      setMessage(!err?.response && /razorpay/i.test(err?.message || '')
        ? 'Could not load the payment window. Check your connection or disable ad/script blockers and try again.'
        : paymentErrorMessage(err, 'Could not start the payment. Please try again.'));
    } finally {
      busyRef.current = false;
    }
  }, [course, applyStatus, pollStatus]);

  /** Resume tracking a payment that was already in flight (e.g. after a page refresh). */
  const resume = useCallback((latestPayment) => {
    if (!latestPayment?.order_id) return;
    setOrderId(latestPayment.order_id);
    if (applyStatus(latestPayment) === 'wait') pollStatus(latestPayment.order_id);
  }, [applyStatus, pollStatus]);

  const reset = useCallback(() => {
    clearTimeout(pollRef.current);
    setPhase('idle');
    setMessage('');
  }, []);

  return { phase, message, orderId, buy, resume, reset, isBusy: ['creating', 'checkout', 'verifying'].includes(phase) };
}
