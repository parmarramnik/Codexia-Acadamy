/**
 * Razorpay Checkout loader. Loads the official script once, on demand.
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loadPromise = null;

export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser'));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay unavailable')));
    script.onerror = () => {
      loadPromise = null;
      script.remove();
      reject(new Error('Could not load Razorpay Checkout'));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}

const OVERLAY_CHECK_MS = 1000;
const OVERLAY_GONE_CHECKS = 3;

function checkoutOverlayVisible() {
  const el = document.querySelector('.razorpay-container');
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/**
 * Open Checkout for a server-created order. Resolves with one of:
 *   { type: 'success', response }  — handler fired (response must still be verified by the backend)
 *   { type: 'dismissed', failure } — modal closed; `failure` holds the last payment.failed error, if any
 *
 * Aborting `signal` closes Checkout and resolves as dismissed.
 */
export async function openRazorpayCheckout({ order, name, description, themeColor, signal }) {
  const Razorpay = await loadRazorpayCheckout();
  if (signal?.aborted) return { type: 'dismissed', failure: null };
  return new Promise((resolve) => {
    let lastFailure = null;
    let settled = false;
    let rzp = null;
    let watchdog = null;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        clearInterval(watchdog);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      }
    };
    const onAbort = () => {
      try {
        rzp?.close();
      } catch { /* already closed */ }
      settle({ type: 'dismissed', failure: lastFailure });
    };
    signal?.addEventListener('abort', onAbort);

    rzp = new Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name,
      description,
      prefill: order.prefill || {},
      notes: { course_id: String(order.course?.id ?? '') },
      theme: { color: themeColor || '#4F46E5' },
      // Pin UPI to the top; cards, netbanking and wallets still follow as default blocks.
      // Checkout only renders methods enabled on the Razorpay account, so UPI must be active there too.
      config: {
        display: {
          blocks: {
            upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] },
          },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: true },
        },
      },
      retry: { enabled: true },
      handler: (response) => settle({ type: 'success', response }),
      modal: {
        ondismiss: () => settle({ type: 'dismissed', failure: lastFailure }),
        confirm_close: true,
      },
    });
    rzp.on('payment.failed', (resp) => {
      // Checkout stays open so the learner can retry; we report it only if they close it.
      lastFailure = resp?.error || { description: 'Payment failed' };
    });
    rzp.open();

    // Razorpay's own error screen ("Oops! Something went wrong") can close without calling
    // ondismiss, which left the purchase stuck. Once the overlay has been seen, its staying
    // gone for a few seconds counts as a dismissal. If Razorpay renames the overlay, it is
    // never "seen" and this does nothing.
    let seen = false;
    let goneChecks = 0;
    watchdog = setInterval(() => {
      if (checkoutOverlayVisible()) {
        seen = true;
        goneChecks = 0;
      } else if (seen && ++goneChecks >= OVERLAY_GONE_CHECKS) {
        settle({ type: 'dismissed', failure: lastFailure });
      }
    }, OVERLAY_CHECK_MS);
  });
}
