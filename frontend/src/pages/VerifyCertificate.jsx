import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import {
  FiCheckCircle, FiAlertTriangle, FiXCircle, FiDownload, FiCopy, FiShare2,
  FiSearch, FiShield, FiArrowRight, FiCode,
} from 'react-icons/fi';
import CertificateDocument from '../components/certificates/CertificateDocument';
import { certificatePdfUrl, formatCertDate } from '../utils/certificates';
import '../styles/pages/verify.css';

const STATUS = {
  VERIFIED: {
    tone: 'success',
    icon: FiCheckCircle,
    title: 'Verified certificate',
    text: 'This certificate was issued by Codexia Academy and matches our official records.',
  },
  REVOKED: {
    tone: 'danger',
    icon: FiXCircle,
    title: 'Certificate revoked',
    text: 'This certificate was issued by Codexia Academy but has since been revoked and is no longer valid.',
  },
  INTEGRITY_FAILED: {
    tone: 'danger',
    icon: FiAlertTriangle,
    title: 'Verification failed',
    text: 'The details of this record do not match its digital signature. Do not accept this certificate as valid.',
  },
};

function VerifyShell({ children }) {
  return (
    <div className="verify-page">
      <header className="verify-topbar">
        <Link to="/" className="verify-brand" aria-label="Codexia Academy home">
          <span className="verify-brand-mark" aria-hidden="true"><FiCode size={15} strokeWidth={2.5} /></span>
          Codexia <span>Academy</span>
        </Link>
        <span className="verify-topbar-label"><FiShield size={14} /> Credential verification</span>
      </header>
      <main className="verify-main">{children}</main>
    </div>
  );
}

function LookupForm({ initial = '', compact = false }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const submit = (e) => {
    e.preventDefault();
    const id = value.trim();
    if (id) navigate(`/verify/${encodeURIComponent(id)}`);
  };
  return (
    <form onSubmit={submit} className={`verify-lookup ${compact ? 'compact' : ''}`} role="search">
      <label htmlFor="verify-id" className="form-label">Certificate ID or credential number</label>
      <div className="verify-lookup-row">
        <div className="input-with-icon">
          <span className="input-icon"><FiSearch size={16} /></span>
          <input
            id="verify-id"
            className="form-input"
            placeholder="e.g. CDX-2026-7KQ2-M9XA"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
          Verify <FiArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}

export default function VerifyCertificate() {
  const { uid } = useParams();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    setCert(null);
    api.get(`/certificates/${encodeURIComponent(uid)}/verify`)
      .then((res) => { if (active) setCert(res.data); })
      .catch((err) => {
        if (!active) return;
        const status = err.response?.status;
        setError(status === 404
          ? 'No certificate matches this ID. Check that it was typed exactly as printed on the certificate.'
          : 'We could not reach the verification service. Please try again in a moment.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [uid]);

  useEffect(() => {
    document.title = cert
      ? `${cert.user_full_name} · ${cert.course_title} | Codexia Certificate Verification`
      : 'Certificate Verification | Codexia Academy';
  }, [cert]);

  if (!uid) {
    return (
      <VerifyShell>
        <section className="verify-card verify-intro">
          <span className="verify-intro-icon"><FiShield size={22} /></span>
          <h1>Verify a certificate</h1>
          <p>Enter the credential number or certificate ID printed on a Codexia Academy certificate, or scan its QR code.</p>
          <LookupForm />
        </section>
      </VerifyShell>
    );
  }

  if (isLoading) {
    return (
      <VerifyShell>
        <section className="verify-card verify-loading" aria-busy="true">
          <span className="loader" aria-hidden="true" />
          <p>Checking this certificate against Codexia Academy records…</p>
        </section>
      </VerifyShell>
    );
  }

  if (error) {
    return (
      <VerifyShell>
        <section className="verify-card verify-intro">
          <span className="verify-intro-icon danger"><FiAlertTriangle size={22} /></span>
          <h1>Certificate not found</h1>
          <p>{error}</p>
          <code className="verify-queried">{uid}</code>
          <LookupForm compact />
        </section>
      </VerifyShell>
    );
  }

  const meta = STATUS[cert.status] || STATUS.INTEGRITY_FAILED;
  const StatusIcon = meta.icon;
  const isValid = cert.status === 'VERIFIED';
  const shareUrl = `${window.location.origin}/verify/${cert.certificate_uid}`;

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${cert.user_full_name} — ${cert.course_title}`, url: shareUrl });
      } catch { /* dismissed */ }
    } else {
      copy(shareUrl, 'Verification link');
    }
  };

  return (
    <VerifyShell>
      <section className={`verify-status ${meta.tone}`} role="status">
        <span className="verify-status-icon"><StatusIcon size={22} /></span>
        <div>
          <h1>{meta.title}</h1>
          <p>{meta.text}</p>
          {cert.checked_at && (
            <span className="verify-checked">
              Checked {new Date(cert.checked_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          )}
        </div>
      </section>

      <div className="verify-layout">
        <div className={`verify-doc ${isValid ? '' : 'invalid'}`}>
          <CertificateDocument certificate={cert} />
          {!isValid && <div className="verify-doc-stamp" aria-hidden="true">NOT VALID</div>}
        </div>

        <aside className="verify-card verify-details">
          <h2>Certificate details</h2>
          <dl>
            <div><dt>Recipient</dt><dd>{cert.user_full_name}</dd></div>
            <div>
              <dt>Course</dt>
              <dd>
                {cert.course_slug
                  ? <Link to={`/courses/${cert.course_slug}`}>{cert.course_title}</Link>
                  : cert.course_title}
              </dd>
            </div>
            <div><dt>Instructor</dt><dd>{cert.instructor_name}</dd></div>
            <div><dt>Issued by</dt><dd>{cert.issuer}</dd></div>
            <div><dt>Date of issue</dt><dd>{formatCertDate(cert.completion_date)}</dd></div>
            <div>
              <dt>Credential ID</dt>
              <dd className="mono">
                {cert.credential_id}
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => copy(cert.credential_id, 'Credential ID')} aria-label="Copy credential ID"><FiCopy size={13} /></button>
              </dd>
            </div>
            <div><dt>Verification code</dt><dd className="mono">{cert.verification_code}</dd></div>
            <div><dt>Certificate ID</dt><dd className="mono small">{cert.certificate_uid}</dd></div>
          </dl>

          <p className="verify-hint">
            The credential ID and verification code above must match the ones printed on the certificate you were given.
          </p>

          <div className="verify-actions">
            {isValid && (
              <a className="btn btn-primary btn-block" href={certificatePdfUrl(cert.certificate_uid, { download: true })}>
                <FiDownload size={15} /> Download PDF
              </a>
            )}
            <button type="button" className="btn btn-secondary btn-block" onClick={share}>
              <FiShare2 size={15} /> Share verification link
            </button>
          </div>
        </aside>
      </div>

      <section className="verify-card verify-another">
        <LookupForm compact />
      </section>
    </VerifyShell>
  );
}
