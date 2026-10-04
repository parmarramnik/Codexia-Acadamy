import api from '../services/api';

/** Backend URLs — rendered on demand from the database, never from local files. */
export const certificatePdfUrl = (uid, { download = false } = {}) =>
  `${api.defaults.baseURL}/certificates/${encodeURIComponent(uid)}/pdf${download ? '?download=true' : ''}`;

export const certificateQrUrl = (uid) =>
  `${api.defaults.baseURL}/certificates/${encodeURIComponent(uid)}/qr.svg`;

/** Public verification page on this frontend (always the current deployed origin). */
export const certificateVerifyUrl = (uid) =>
  `${window.location.origin}/verify/${encodeURIComponent(uid)}`;

export const formatCertDate = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/* Deterministic per-certificate security pattern (mirrors backend utils/pdf_generator.py). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function guillochePaths(uid, radius = 190) {
  const seed = parseInt(String(uid || '').replace(/-/g, '').slice(0, 8), 16) || 0x9e3779b9;
  const rnd = mulberry32(seed);
  const k1 = 10 + Math.floor(rnd() * 9);
  const k2 = 3 + Math.floor(rnd() * 5);
  const a1 = 0.1 + rnd() * 0.06;
  const a2 = 0.04 + rnd() * 0.04;
  const phase = rnd() * Math.PI * 2;
  const rings = 11;
  const steps = 360;
  const paths = [];
  for (let ring = 0; ring < rings; ring += 1) {
    const base = radius * (0.38 + (0.6 * ring) / (rings - 1));
    const shift = phase + ring * 0.21;
    let d = '';
    for (let i = 0; i <= steps; i += 1) {
      const th = (2 * Math.PI * i) / steps;
      const r = base * (1 + a1 * Math.sin(k1 * th + shift) + a2 * Math.cos(k2 * th - shift));
      // SVG y grows downward; flip to match the PDF orientation
      d += `${i ? 'L' : 'M'}${(r * Math.cos(th)).toFixed(1)} ${(-r * Math.sin(th)).toFixed(1)}`;
    }
    paths.push(`${d}Z`);
  }
  return paths;
}
