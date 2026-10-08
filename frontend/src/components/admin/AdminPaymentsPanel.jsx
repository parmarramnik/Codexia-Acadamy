import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiAlertTriangle, FiRefreshCw, FiRotateCcw, FiSearch } from 'react-icons/fi';
import paymentService, { paymentErrorMessage } from '../../services/paymentService';
import useDebounce from '../../hooks/useDebounce';
import { formatMinor } from '../../utils/money';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'CREATED', label: 'Created' },
];
const STATUS_BADGE = {
  SUCCESS: 'badge-success', PENDING: 'badge-warning', FAILED: 'badge-danger',
  REFUNDED: 'badge-info', CREATED: 'badge-neutral',
};
const PAGE_SIZE = 20;

function formatDate(iso) {
  if (!iso) return '—';
  // Backend timestamps are UTC; older rows may lack an explicit offset.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

/**
 * Admin payment ledger. Everything shown comes from the backend; refunds are requested from
 * Razorpay by the server and a payment only shows REFUNDED once Razorpay confirms it.
 */
export default function AdminPaymentsPanel() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [reconcilingAll, setReconcilingAll] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (status) params.status = status;
      if (debouncedSearch) params.search = debouncedSearch;
      const [list, sum] = await Promise.all([paymentService.adminList(params), paymentService.adminSummary()]);
      setData(list.data);
      setSummary(sum.data);
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Failed to load payments'));
    } finally {
      setIsLoading(false);
    }
  }, [page, status, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const replaceRow = (row) => setData((d) => ({ ...d, items: d.items.map((p) => (p.id === row.id ? row : p)) }));

  const handleRefund = async (p) => {
    const amount = formatMinor(p.amount, p.currency);
    const reason = window.prompt(
      `Refund ${amount} to ${p.student_email || 'this student'} for "${p.course_title}"?\n`
      + 'Course access is removed once Razorpay confirms the refund.\n\nReason (optional):',
      '',
    );
    if (reason === null) return;
    setBusyId(p.id);
    try {
      const res = await paymentService.adminRefund(p.id, reason.trim() || null);
      replaceRow(res.data);
      toast.success(res.data.status === 'REFUNDED' ? 'Refund processed' : 'Refund requested — awaiting Razorpay confirmation');
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Refund failed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReconcile = async (p) => {
    setBusyId(p.id);
    try {
      const res = await paymentService.adminReconcileOne(p.id);
      replaceRow(res.data);
      toast.success(`Status: ${res.data.status}`);
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Could not re-check this payment'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReconcileAll = async () => {
    setReconcilingAll(true);
    try {
      const res = await paymentService.adminReconcileAll();
      toast.success(`Checked ${res.data.checked} payment(s), updated ${res.data.updated}`);
      load();
    } catch (err) {
      toast.error(paymentErrorMessage(err, 'Reconciliation failed'));
    } finally {
      setReconcilingAll(false);
    }
  };

  const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const counts = summary?.counts || {};

  return (
    <div style={styles.wrap}>
      {summary && (!summary.gateway_configured || !summary.webhook_configured) && (
        <div className="alert alert-warning" role="status">
          <FiAlertTriangle size={15} />
          <span>
            {!summary.gateway_configured
              ? 'Razorpay keys are not configured on the server — paid courses cannot be purchased.'
              : 'RAZORPAY_WEBHOOK_SECRET is not configured — payments still verify at checkout, but webhook confirmation is disabled.'}
          </span>
        </div>
      )}

      <div style={styles.statsGrid}>
        <div className="stat-card">
          <span className="stat-label">Revenue (successful)</span>
          <span style={styles.statValue}>{formatMinor(summary?.revenue?.amount || 0, summary?.revenue?.currency || 'INR')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Successful</span>
          <span style={styles.statValue}>{counts.SUCCESS || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending / Failed</span>
          <span style={styles.statValue}>{(counts.PENDING || 0)} / {(counts.FAILED || 0)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Refunded</span>
          <span style={styles.statValue}>{counts.REFUNDED || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Gateway mode</span>
          <span style={styles.statValue}>
            {summary?.mode ? <span className={`badge ${summary.mode === 'live' ? 'badge-success' : 'badge-warning'}`}>{summary.mode.toUpperCase()}</span> : '—'}
          </span>
        </div>
      </div>

      {summary?.access_pending > 0 && (
        <div className="alert alert-error" role="alert">
          <FiAlertTriangle size={15} />
          <span>
            {summary.access_pending} paid payment(s) are still waiting for course access. Use “Re-check open payments” to retry.
          </span>
        </div>
      )}

      <div style={styles.toolbar}>
        <div className="segmented" role="tablist" aria-label="Filter payments by status">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              role="tab"
              aria-selected={status === f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={styles.searchBox}>
          <FiSearch size={15} style={styles.searchIcon} />
          <input
            type="search"
            className="form-input"
            placeholder="Search student, course, order or payment ID"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={styles.searchInput}
            aria-label="Search payments"
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleReconcileAll} disabled={reconcilingAll}>
          <FiRefreshCw size={13} /> {reconcilingAll ? 'Checking…' : 'Re-check open payments'}
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Course</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment / Order ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && data.items.length === 0 ? (
              <tr><td colSpan={7} style={styles.empty}>Loading payments…</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={7} style={styles.empty}>No payments match these filters.</td></tr>
            ) : data.items.map((p) => {
              const refundBusy = ['requested', 'pending', 'processed'].includes(p.refund_status);
              return (
                <tr key={p.id}>
                  <td style={styles.nowrap}>{formatDate(p.paid_at || p.created_at)}</td>
                  <td>
                    <div style={styles.primaryText}>{p.student_name || 'Deleted user'}</div>
                    <div style={styles.subText}>{p.student_email || ''}</div>
                  </td>
                  <td style={styles.courseCell}>{p.course_title || '—'}</td>
                  <td style={styles.nowrap}>{formatMinor(p.amount, p.currency)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status] || 'badge-neutral'}`}>{p.status}</span>
                    {p.payment_method && <div style={styles.subText}>{p.payment_method}</div>}
                    {p.refund_status && p.status !== 'REFUNDED' && (
                      <div style={styles.subText}>Refund: {p.refund_status}</div>
                    )}
                    {p.status === 'SUCCESS' && !p.access_granted && (
                      <div style={{ ...styles.subText, color: 'var(--danger)' }}>Access pending</div>
                    )}
                    {p.admin_note && <div style={{ ...styles.subText, color: 'var(--warning)' }}>{p.admin_note}</div>}
                    {p.failure_reason && p.status !== 'SUCCESS' && <div style={styles.subText}>{p.failure_reason}</div>}
                  </td>
                  <td style={styles.ids}>
                    <div>{p.razorpay_payment_id || '—'}</div>
                    <div style={styles.subText}>{p.razorpay_order_id}</div>
                  </td>
                  <td>
                    <div style={styles.actions}>
                      {p.status === 'SUCCESS' && !refundBusy && (
                        <button type="button" className="btn btn-danger btn-sm" disabled={busyId === p.id} onClick={() => handleRefund(p)}>
                          <FiRotateCcw size={12} /> Refund
                        </button>
                      )}
                      {(p.status !== 'REFUNDED' || refundBusy) && (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === p.id} onClick={() => handleReconcile(p)}
                          title="Re-check this payment with Razorpay">
                          <FiRefreshCw size={12} /> Re-check
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.pager}>
        <span style={styles.subText}>{data.total || 0} payment(s)</span>
        <div style={styles.actions}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={styles.subText}>Page {page} of {pages}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages || isLoading} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '1rem' },
  statValue: { fontSize: '1.4rem', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' },
  toolbar: { display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { position: 'relative', flex: 1, minWidth: '220px' },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' },
  searchInput: { paddingLeft: 34, width: '100%' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', height: 80 },
  nowrap: { whiteSpace: 'nowrap' },
  primaryText: { fontWeight: 'var(--fw-medium)' },
  subText: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 },
  courseCell: { maxWidth: 220 },
  ids: { fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all', maxWidth: 200 },
  actions: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  pager: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' },
};
