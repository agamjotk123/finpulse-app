/** Allocation-light statistics over Float64Array. NaN always means "missing". */

export function finite(values: ArrayLike<number>): Float64Array {
  let n = 0;
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) n++;
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) out[j++] = values[i];
  return out;
}

export function sortedCopy(values: ArrayLike<number>): Float64Array {
  return Float64Array.from(values).sort();
}

export function mean(v: ArrayLike<number>): number {
  if (!v.length) return NaN;
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return s / v.length;
}

export function std(v: ArrayLike<number>, m = mean(v)): number {
  if (v.length < 2) return NaN;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const d = v[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / (v.length - 1));
}

/** Linear-interpolated quantile of an already-sorted array. */
export function quantileSorted(s: ArrayLike<number>, p: number): number {
  if (!s.length) return NaN;
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function median(v: ArrayLike<number>): number {
  return quantileSorted(sortedCopy(v), 0.5);
}

/** Median absolute deviation (unscaled). */
export function mad(v: ArrayLike<number>, med = median(v)): number {
  const dev = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) dev[i] = Math.abs(v[i] - med);
  dev.sort();
  return quantileSorted(dev, 0.5);
}

export function meanAbsDev(v: ArrayLike<number>, center: number): number {
  if (!v.length) return NaN;
  let s = 0;
  for (let i = 0; i < v.length; i++) s += Math.abs(v[i] - center);
  return s / v.length;
}

/**
 * Robust centre/scale. `scale` is comparable to a standard deviation on normal data
 * (MAD × 1.4826), falling back to mean absolute deviation and then std when MAD is 0 —
 * common in finance (identical fees, round amounts, lots of zeros).
 */
export function robustScale(v: ArrayLike<number>): { center: number; scale: number } {
  const center = median(v);
  const m = mad(v, center);
  if (m > 0) return { center, scale: m * 1.4826 };
  const meanDev = meanAbsDev(v, center);
  if (meanDev > 0) return { center, scale: meanDev * 1.2533 };
  const s = std(v);
  return { center, scale: Number.isFinite(s) ? s : 0 };
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Maps "how far past the threshold" to 0.5..1 without saturating early:
 * 0.5 at the threshold, 0.88 at 2×, 0.94 at 3×, 0.995 at 10×. A value 50× past the
 * limit therefore still outranks one that is barely 3× past it.
 */
export function strength(magnitude: number, threshold: number): number {
  if (!(magnitude >= threshold) || threshold <= 0) return 0;
  const ratio = threshold / magnitude;
  return clamp(1 - 0.5 * ratio * ratio);
}

/**
 * Audit materiality: for money-like columns (positive and skewed), an unusually SMALL
 * value is far less risky than an unusually LARGE one, so low-side evidence is halved.
 */
export const LOW_SIDE_DISCOUNT = 0.5;
export function materiality(isLowSide: boolean, moneyLike: boolean): number {
  return isLowSide && moneyLike ? LOW_SIDE_DISCOUNT : 1;
}

/** Deterministic PRNG so every run of the same file gives the same answer. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rolling (centred) median using a sorted window: O(n·w) rather than O(n·w·log w). */
export function rollingMedian(v: ArrayLike<number>, w: number): Float64Array {
  const n = v.length;
  const out = new Float64Array(n);
  if (!n) return out;
  const half = w >> 1;
  const win: number[] = [];
  const lowerBound = (x: number) => {
    let lo = 0;
    let hi = win.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (win[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  let left = 0;
  let right = -1;
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    while (right < hi) {
      const x = v[++right];
      win.splice(lowerBound(x), 0, x);
    }
    while (left < lo) win.splice(lowerBound(v[left++]), 1);
    const m = win.length;
    out[i] = m % 2 ? win[(m - 1) >> 1] : (win[m / 2 - 1] + win[m / 2]) / 2;
  }
  return out;
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const nfCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

/** Human formatting for explanations ("1.2M", "4,310.5"). */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.abs(n) >= 1e6 ? nfCompact.format(n) : nf.format(n);
}

export interface ScaleTransform {
  log: boolean;
  fwd: (x: number) => number;
  inv: (y: number) => number;
}

const IDENTITY: ScaleTransform = { log: false, fwd: (x) => x, inv: (y) => y };
const LOG: ScaleTransform = { log: true, fwd: Math.log, inv: Math.exp };

/** Sample skewness (Fisher–Pearson). */
export function skewness(v: ArrayLike<number>): number {
  const n = v.length;
  if (n < 3) return 0;
  const m = mean(v);
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < n; i++) {
    const d = v[i] - m;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  return m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
}

/**
 * Financial amounts are usually right-skewed (many small, few large). Testing them on a
 * raw scale flags every legitimately large invoice. For strictly positive, strongly
 * skewed columns we test on a log scale instead — this cuts false positives sharply.
 */
export function chooseTransform(v: ArrayLike<number>): ScaleTransform {
  if (v.length < 8) return IDENTITY;
  for (let i = 0; i < v.length; i++) if (!(v[i] > 0)) return IDENTITY;
  return skewness(v) > 1 ? LOG : IDENTITY;
}

export function applyTransform(v: ArrayLike<number>, t: ScaleTransform): Float64Array {
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = Number.isFinite(v[i]) ? t.fwd(v[i]) : NaN;
  return out;
}
