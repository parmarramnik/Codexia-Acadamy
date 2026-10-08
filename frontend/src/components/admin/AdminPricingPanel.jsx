import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiCheck, FiEdit2, FiSearch, FiX } from 'react-icons/fi';
import paymentService, { paymentErrorMessage } from '../../services/paymentService';
import useDebounce from '../../hooks/useDebounce';
import { formatMinor, minorToInput, validatePriceInput } from '../../utils/money';

const REQUEST_BADGE = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger' };

function priceLabel(type, amount, currency) {
  return type === 'PAID' ? formatMinor(amount, currency) : 'Free';
}

/**
 * Admin-only live pricing + review of instructor price requests. The browser sends a decimal
 * rupee string; the server converts it to paise and re-validates every rule.
 */
export default function AdminPricingPanel() {
  const [courses, setCourses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestFilter, setRequestFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ pricing_type: 'FREE', price: '', is_purchasable: true });
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const loadCourses = useCallback(async () => {
    try {
      const res = await paymentService.adminCoursePricing(debouncedSearch);
      setCourses(res.data || []);
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Failed to load course pricing'));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await paymentService.adminPriceRequests(requestFilter);
      setRequests(res.data || []);
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Failed to load price requests'));
    }
  }, [requestFilter]);

  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({
      pricing_type: c.pricing_type,
      price: c.pricing_type === 'PAID' ? minorToInput(c.price_amount, c.currency) : '',
      is_purchasable: c.is_purchasable,
    });
  };

  const priceError = form.pricing_type === 'PAID' ? validatePriceInput(form.price) : null;

  const save = async (course) => {
    if (priceError) {
      toast.error(priceError);
      return;
    }
    const next = form.pricing_type === 'PAID' ? `₹${form.price.trim()}` : 'Free';
    if (course.pricing_type !== form.pricing_type
      && !window.confirm(`Change "${course.title}" to ${next}? This applies to all new purchases immediately.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await paymentService.adminSetPricing(course.id, {
        pricing_type: form.pricing_type,
        price: form.pricing_type === 'PAID' ? form.price.trim() : null,
        currency: 'INR',
        is_purchasable: form.is_purchasable,
      });
      setCourses((list) => list.map((c) => (c.id === course.id ? { ...c, ...res.data } : c)));
      setEditingId(null);
      toast.success('Pricing saved');
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Could not save pricing'));
    } finally {
      setSaving(false);
    }
  };

  const review = async (req, approve) => {
    const verb = approve ? 'Approve' : 'Reject';
    const note = window.prompt(
      `${verb} the request to set "${req.course_title}" to ${priceLabel(req.pricing_type, req.amount, req.currency)}?`
      + `${approve ? '\nThe new price goes live immediately.' : ''}\n\nNote for the instructor (optional):`,
      '',
    );
    if (note === null) return;
    setReviewingId(req.id);
    try {
      await (approve
        ? paymentService.adminApproveRequest(req.id, note.trim() || null)
        : paymentService.adminRejectRequest(req.id, note.trim() || null));
      toast.success(approve ? 'Price approved and live' : 'Request rejected');
      loadRequests();
      loadCourses();
    } catch (err) {
      toast.error(paymentErrorMessage(err, `Could not ${verb.toLowerCase()} this request`));
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div style={styles.wrap}>
      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h3 style={styles.heading}>Instructor price requests</h3>
          <div className="segmented" role="tablist" aria-label="Filter price requests">
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((s) => (
              <button key={s} type="button" role="tab" aria-selected={requestFilter === s} onClick={() => setRequestFilter(s)}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        {requests.length === 0 ? (
          <p style={styles.muted}>No {requestFilter === 'ALL' ? '' : requestFilter.toLowerCase()} price requests.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Course</th><th>Requested by</th><th>Current</th><th>Requested</th><th>Note</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.course_title || '—'}</td>
                    <td>{r.requested_by_name || '—'}</td>
                    <td style={styles.nowrap}>{priceLabel(r.current_pricing_type, r.current_price_amount, r.currency)}</td>
                    <td style={{ ...styles.nowrap, fontWeight: 'var(--fw-semibold)' }}>{priceLabel(r.pricing_type, r.amount, r.currency)}</td>
                    <td style={styles.noteCell}>
                      {r.note || '—'}
                      {r.review_note && <div style={styles.subText}>Review: {r.review_note}</div>}
                    </td>
                    <td><span className={`badge ${REQUEST_BADGE[r.status] || 'badge-neutral'}`}>{r.status}</span></td>
                    <td>
                      {r.status === 'PENDING' && (
                        <div style={styles.actions}>
                          <button type="button" className="btn btn-success btn-sm" disabled={reviewingId === r.id} onClick={() => review(r, true)}>
                            <FiCheck size={12} /> Approve
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={reviewingId === r.id} onClick={() => review(r, false)}>
                            <FiX size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHead}>
          <h3 style={styles.heading}>Course pricing</h3>
          <div style={styles.searchBox}>
            <FiSearch size={15} style={styles.searchIcon} />
            <input
              type="search"
              className="form-input"
              placeholder="Search courses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
              aria-label="Search courses"
            />
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Course</th><th>Status</th><th>Pricing</th><th>Price</th><th>Currency</th><th>Purchasing</th><th /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={styles.empty}>Loading courses…</td></tr>
              ) : courses.length === 0 ? (
                <tr><td colSpan={7} style={styles.empty}>No courses found.</td></tr>
              ) : courses.map((c) => {
                const editing = editingId === c.id;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 'var(--fw-medium)' }}>{c.title}</div>
                      <div style={styles.subText}>
                        {c.instructor_name}
                        {c.pending_price_requests > 0 && <span style={{ color: 'var(--warning)' }}> · price request pending</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${c.is_published && c.is_approved ? 'badge-success' : 'badge-neutral'}`}>
                        {c.is_published && c.is_approved ? 'Live' : c.is_published ? 'Pending approval' : 'Draft'}
                      </span>
                    </td>
                    {editing ? (
                      <>
                        <td>
                          <div style={styles.radioRow}>
                            {['FREE', 'PAID'].map((t) => (
                              <label key={t} style={styles.radio}>
                                <input type="radio" name={`pricing-${c.id}`} checked={form.pricing_type === t}
                                  onChange={() => setForm({ ...form, pricing_type: t })} />
                                {t === 'FREE' ? 'Free' : 'Paid'}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td>
                          {form.pricing_type === 'PAID' ? (
                            <>
                              <input type="text" inputMode="decimal" className="form-input" style={styles.priceInput}
                                placeholder="499" value={form.price} aria-label="Price in rupees"
                                aria-invalid={Boolean(form.price && priceError)}
                                onChange={(e) => setForm({ ...form, price: e.target.value })} />
                              {form.price && priceError && <div style={styles.error}>{priceError}</div>}
                            </>
                          ) : <span style={styles.muted}>—</span>}
                        </td>
                        <td>INR</td>
                        <td>
                          <label style={styles.radio}>
                            <input type="checkbox" checked={form.is_purchasable}
                              onChange={(e) => setForm({ ...form, is_purchasable: e.target.checked })} />
                            Open
                          </label>
                        </td>
                        <td>
                          <div style={styles.actions}>
                            <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => save(c)}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><span className={`badge ${c.pricing_type === 'PAID' ? 'badge-warning' : 'badge-success'}`}>{c.pricing_type === 'PAID' ? 'Paid' : 'Free'}</span></td>
                        <td style={styles.nowrap}>{c.pricing_type === 'PAID' ? formatMinor(c.price_amount, c.currency) : '—'}</td>
                        <td>{c.currency}</td>
                        <td>{c.pricing_type !== 'PAID' ? '—' : c.is_purchasable ? 'Open' : <span style={{ color: 'var(--warning)' }}>Paused</span>}</td>
                        <td>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>
                            <FiEdit2 size={12} /> Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '2rem' },
  section: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  heading: { fontSize: '1.05rem', fontWeight: 'var(--fw-semibold)', margin: 0 },
  muted: { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 },
  subText: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 },
  nowrap: { whiteSpace: 'nowrap' },
  noteCell: { maxWidth: 260 },
  empty: { textAlign: 'center', color: 'var(--text-muted)', height: 80 },
  actions: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  radioRow: { display: 'flex', gap: '0.75rem' },
  radio: { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  priceInput: { width: 110 },
  error: { fontSize: '0.72rem', color: 'var(--danger)', marginTop: 4 },
  searchBox: { position: 'relative', minWidth: '220px', flex: '0 1 320px' },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' },
  searchInput: { paddingLeft: 34, width: '100%' },
};
