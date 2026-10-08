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

/**
 * Open Checkout for a server-created order. Resolves with one of:
 *   { type: 'success', response }  — handler fired (response must still be verified by the backend)
 *   { type: 'dismissed', failure } — modal closed; `failure` holds the last payment.failed error, if any
 */
export async function openRazorpayCheckout({ order, name, description, themeColor }) {
  const Razorpay = await loadRazorpayCheckout();
  return new Promise((resolve) => {
    let lastFailure = null;
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const rzp = new Razorpay({
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
  });
}
