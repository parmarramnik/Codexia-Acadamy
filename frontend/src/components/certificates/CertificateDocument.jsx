import { useMemo } from 'react';
import { certificateQrUrl, formatCertDate, guillochePaths } from '../../utils/certificates';
import '../../styles/pages/certificate.css';

/**
 * On-screen rendition of the official certificate (same layout as the PDF).
 * Scales to any width via container query units, so it reads well on phones.
 */
export default function CertificateDocument({ certificate }) {
  const {
    certificate_uid: uid,
    credential_id: credentialId,
    verification_code: code,
    user_full_name: name,
    course_title: course,
    instructor_name: instructor,
    completion_date: completionDate,
    course_duration_hours: hours,
    course_total_lectures: lectures,
  } = certificate;

  const paths = useMemo(() => guillochePaths(uid), [uid]);
  const issued = formatCertDate(completionDate);
  const year = new Date(completionDate).getFullYear() || new Date().getFullYear();
  const verifyUrl = certificate.verification_url || `${window.location.origin}/verify/${uid}`;
  const verifyHost = verifyUrl.replace(/^https?:\/\//, '');

  const nameSize = name?.length > 40 ? 24 : name?.length > 28 ? 30 : 38;
  const courseSize = course?.length > 110 ? 14 : course?.length > 60 ? 17 : 20;
  const meta = ['Online program'];
  if (hours) meta.push(`${hours} learning hours`);
  if (lectures) meta.push(`${lectures} lectures`);
  meta.push(`Completed ${issued}`);

  const micro = `CODEXIA ACADEMY · ${credentialId || ''} · `.repeat(30);

  return (
    <div className="cert-doc-wrap">
      <article className="cert-doc" aria-label={`Certificate of completion for ${name}`}>
        <svg className="cert-guilloche" viewBox="-230 -230 460 460" aria-hidden="true">
          {paths.map((d, i) => <path key={i} d={d} />)}
        </svg>
        <div className="cert-frame-outer" aria-hidden="true" />
        <div className="cert-frame-inner" aria-hidden="true" />
        <div className="cert-micro cert-micro-top" aria-hidden="true">{micro}</div>
        <div className="cert-micro cert-micro-bottom" aria-hidden="true">{micro}</div>

        <aside className="cert-panel">
          <div className="cert-mark" aria-hidden="true">&lt;/&gt;</div>
          <div className="cert-brand">CODEXIA</div>
          <div className="cert-brand-sub">ACADEMY</div>
          <div className="cert-panel-rule" />

          <dl className="cert-fields">
            <div><dt>CREDENTIAL ID</dt><dd className="mono">{credentialId || '—'}</dd></div>
            <div><dt>DATE OF ISSUE</dt><dd>{issued}</dd></div>
            <div><dt>VERIFICATION CODE</dt><dd className="mono">{code || '—'}</dd></div>
          </dl>

          <div className="cert-qr">
            <img src={certificateQrUrl(uid)} alt="QR code linking to this certificate's verification page" />
          </div>
          <div className="cert-qr-label">Scan to verify authenticity</div>
          <div className="cert-qr-url">{verifyHost}</div>
        </aside>

        <section className="cert-main">
          <div className="cert-eyebrow">CERTIFICATE OF COMPLETION</div>
          <div className="cert-ornament" aria-hidden="true"><span /><i /><span /></div>
          <p className="cert-lead">This is to certify that</p>
          <h2 className="cert-name" style={{ '--size': nameSize }}>{name}</h2>
          <div className="cert-name-rule" />
          <p className="cert-text">has successfully completed all requirements of the course</p>
          <h3 className="cert-course" style={{ '--size': courseSize }}>{course}</h3>
          <p className="cert-meta">{meta.join('  ·  ')}</p>

          <div className="cert-signatures">
            <div className="cert-sig">
              <div className="cert-sig-script">{instructor}</div>
              <div className="cert-sig-line" />
              <div className="cert-sig-name">{instructor}</div>
              <div className="cert-sig-role">Course Instructor</div>
            </div>

            <svg className="cert-seal" viewBox="-42 -42 84 84" aria-hidden="true">
              <polygon
                points={Array.from({ length: 120 }, (_, i) => {
                  const r = i % 2 ? 37 : 40;
                  const a = (Math.PI * i) / 60;
                  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
                }).join(' ')}
                fill="#B08D57"
              />
              <circle r="33" fill="#0E1B30" />
              <circle r="31" fill="none" stroke="#D8C08E" strokeWidth="0.6" />
              <circle r="19" fill="none" stroke="#D8C08E" strokeWidth="0.6" />
              <defs><path id={`seal-${uid}`} d="M0,-23.2 a23.2,23.2 0 1,1 -0.01,0" /></defs>
              <text fill="#D8C08E" fontSize="5.2" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif">
                <textPath href={`#seal-${uid}`} textLength="144" lengthAdjust="spacing">
                  CODEXIA ACADEMY · VERIFIED CREDENTIAL ·
                </textPath>
              </text>
              <text y="3.5" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif">&lt;/&gt;</text>
              <text y="11" textAnchor="middle" fill="#D8C08E" fontSize="6" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif">{year}</text>
            </svg>

            <div className="cert-sig">
              <div className="cert-sig-script">Codexia Academy</div>
              <div className="cert-sig-line" />
              <div className="cert-sig-name">Office of Academic Records</div>
              <div className="cert-sig-role">Issuing Authority</div>
            </div>
          </div>

          <p className="cert-footer">Verify this credential at {verifyUrl}</p>
        </section>
      </article>
    </div>
  );
}
