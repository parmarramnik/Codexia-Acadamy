/**
 * Money display helpers. Amounts from the API are integers in the smallest currency
 * unit (paise for INR). Display only — the frontend never computes what is charged.
 */
const MINOR_UNITS = { INR: 100 };

export function formatMinor(amount, currency = 'INR') {
  const divisor = MINOR_UNITS[currency] || 100;
  const value = Number(amount || 0) / divisor;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Minor units -> editable major-unit string (49900 -> "499", 49950 -> "499.50"). */
export function minorToInput(amount, currency = 'INR') {
  const divisor = MINOR_UNITS[currency] || 100;
  const whole = Math.trunc(Number(amount || 0) / divisor);
  const frac = Math.abs(Number(amount || 0) % divisor);
  return frac ? `${whole}.${String(frac).padStart(2, '0')}` : String(whole);
}

export function isPaidCourse(course) {
  return (course?.pricing_type || 'FREE').toUpperCase() === 'PAID' && Number(course?.price_amount) > 0;
}

/** Light client-side check mirroring the server rules (the server re-validates everything). */
export function validatePriceInput(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Enter a price';
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Use a positive number with up to 2 decimals';
  const n = Number(v);
  if (n < 1) return 'Minimum price is ₹1';
  if (n > 500000) return 'Maximum price is ₹5,00,000';
  return null;
}
