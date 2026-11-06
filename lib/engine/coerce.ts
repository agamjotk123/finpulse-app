/** Kept separate from parse.ts so the UI can use it without bundling SheetJS. */

const NUMERIC_BODY = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const LEADING_CURRENCY = /^(?:[$€£¥₹]|[A-Z]{3}\s+|Rs\.?\s*)/;
const TRAILING_CURRENCY = /(?:\s+[A-Z]{3}|[$€£¥₹])$/;

/**
 * Converts what accountants actually type into numbers:
 * "1,234.50", "(1,234.50)", "1,234.50-", "$ 99", "AED 1,000", "12%", "-$5".
 * Returns NaN for anything that isn't confidently numeric (so "Q1" stays text).
 */
export function coerceNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  let s = v.trim();
  if (!s || s.length > 40) return NaN;

  let sign = 1;
  if (s.startsWith('(') && s.endsWith(')')) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }
  if (s.endsWith('-') && !s.startsWith('-')) {
    sign = -sign;
    s = s.slice(0, -1).trim();
  }
  if (s.startsWith('-') || s.startsWith('+')) {
    if (s[0] === '-') sign = -sign;
    s = s.slice(1).trim();
  }
  s = s.replace(LEADING_CURRENCY, '').replace(TRAILING_CURRENCY, '').trim();
  if (s.startsWith('-') || s.startsWith('+')) {
    if (s[0] === '-') sign = -sign;
    s = s.slice(1);
  }
  const percent = s.endsWith('%');
  if (percent) s = s.slice(0, -1);
  s = s.replace(/[\s,'_]/g, '');
  if (!NUMERIC_BODY.test(s)) return NaN;

  let n = Number(s) * sign;
  if (percent) n /= 100;
  return Number.isFinite(n) ? n : NaN;
}
