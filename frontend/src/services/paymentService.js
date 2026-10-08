import api from './api';

/**
 * Payments & pricing API. Purchase calls only ever send a courseId — the backend
 * reads the official price from the database.
 */
const paymentService = {
  // Student
  createOrder: (courseId) => api.post('/payments/razorpay/order', { course_id: courseId }),
  verify: ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) =>
    api.post('/payments/razorpay/verify', { razorpay_order_id, razorpay_payment_id, razorpay_signature }),
  getOrderStatus: (orderId) => api.get(`/payments/orders/${encodeURIComponent(orderId)}/status`),
  getCourseState: (courseId) => api.get(`/payments/courses/${courseId}/state`),
  myPayments: () => api.get('/payments/me'),

  // Admin — payments
  adminSummary: () => api.get('/payments/admin/summary'),
  adminList: (params = {}) => api.get('/payments/admin/list', { params }),
  adminRefund: (paymentId, reason) => api.post(`/payments/admin/${paymentId}/refund`, { reason }),
  adminReconcileOne: (paymentId) => api.post(`/payments/admin/${paymentId}/reconcile`),
  adminReconcileAll: () => api.post('/payments/admin/reconcile'),

  // Admin — pricing
  adminCoursePricing: (search) => api.get('/pricing/admin/courses', { params: search ? { search } : {} }),
  adminSetPricing: (courseId, data) => api.put(`/pricing/admin/courses/${courseId}`, data),
  adminPriceRequests: (status = 'PENDING') => api.get('/pricing/admin/requests', { params: { status } }),
  adminApproveRequest: (id, review_note) => api.post(`/pricing/admin/requests/${id}/approve`, { review_note }),
  adminRejectRequest: (id, review_note) => api.post(`/pricing/admin/requests/${id}/reject`, { review_note }),

  // Instructor
  submitPriceRequest: (data) => api.post('/pricing/requests', data),
  myPriceRequests: () => api.get('/pricing/requests/mine'),
};

/** Extract a user-facing message from either `{detail: "..."}` or `{detail: {message, code}}`. */
export function paymentErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.response ? fallback : 'Network error. Check your connection and try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || fallback;
  return detail.message || fallback;
}

export function paymentErrorCode(err) {
  const detail = err?.response?.data?.detail;
  return detail && typeof detail === 'object' && !Array.isArray(detail) ? detail.code : undefined;
}

export default paymentService;
