import { chooseTransform, finite, fmt, materiality, median, robustScale, rollingMedian, strength } from '../stats';
import { analyzableColumns, makeFinding, type Detector } from './shared';
import type { Finding } from '../types';

const DAY = 86_400_000;
const HALF_DAY = DAY / 2;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Plan {
  label: string;
  buckets: number;
  periodDays: number;
  bucketOf: (t: number) => number;
  bucketName: (b: number) => string;
}

/**
 * Shift by 12h before reading calendar fields: SheetJS gives local-midnight dates and
 * Date.parse gives UTC-midnight dates; +12h lands on the right calendar day for every
 * time zone between UTC−12 and UTC+12 (including Dubai, UTC+4).
 */
const cal = (t: number) => new Date(t + HALF_DAY);

function choosePlan(medianGapDays: number): Plan {
  if (medianGapDays >= 25) {
    return {
      label: 'monthly',
      buckets: 12,
      periodDays: 365,
      bucketOf: (t) => cal(t).getUTCMonth(),
      bucketName: (b) => MONTHS[b],
    };
  }
  if (medianGapDays >= 6) {
    return {
      label: 'weekly',
      buckets: 52,
      periodDays: 365,
      bucketOf: (t) => {
        const d = cal(t);
        const dayOfYear = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY);
        return Math.min(51, Math.floor(dayOfYear / 7));
      },
      bucketName: (b) => `week ${b + 1}`,
    };
  }
  return {
    label: 'day-of-week',
    buckets: 7,
    periodDays: 7,
    bucketOf: (t) => cal(t).getUTCDay(),
    bucketName: (b) => WEEKDAYS[b],
  };
}

/**
 * Classical decomposition: value = rolling-median trend + seasonal index + residual.
 * Flags residuals that are extreme in robust units. A December spike that happens every
 * December is NOT flagged; the same spike in April is.
 */
export const detectSeasonal: Detector = (sheet, cfg) => {
  const dates = sheet.dates;
  if (!dates || !sheet.dateColumn) return { findings: [], skipped: 'No date column detected.' };

  const order: number[] = [];
  for (let i = 0; i < dates.length; i++) if (Number.isFinite(dates[i])) order.push(i);
  if (order.length < 24) return { findings: [], skipped: 'Needs at least 24 dated rows.' };
  order.sort((a, b) => dates[a] - dates[b]);

  const gaps: number[] = [];
  for (let k = 1; k < order.length; k++) {
    const g = dates[order[k]] - dates[order[k - 1]];
    if (g > 0) gaps.push(g / DAY);
  }
  if (!gaps.length) return { findings: [], skipped: 'All rows share the same date.' };

  const plan = choosePlan(median(gaps));
  const spanDays = Math.max(1, (dates[order[order.length - 1]] - dates[order[0]]) / DAY);
  const seasonalPossible = spanDays >= plan.periodDays * 1.8;
  const t = cfg.seasonal.residualThreshold;
  const findings: Finding[] = [];
  const cols = analyzableColumns(sheet, cfg.maxColumns);

  for (let c = 0; c < cols.length; c++) {
    const name = cols[c].name;
    const raw = sheet.numeric[name];
    const idx: number[] = [];
    for (let k = 0; k < order.length; k++) if (Number.isFinite(raw[order[k]])) idx.push(order[k]);
    if (idx.length < 24) continue;

    const original = Float64Array.from(idx, (i) => raw[i]);
    const tf = chooseTransform(original);
    const vals = tf.log ? original.map(tf.fwd) : original;
    // Window ≈ one seasonal period's worth of rows (works for both aggregated and transactional data).
    const rowsPerPeriod = (idx.length * plan.periodDays) / spanDays;
    const w = Math.min(401, Math.max(5, Math.round(rowsPerPeriod))) | 1;
    const trend = rollingMedian(vals, w);

    const bucket = new Int32Array(idx.length);
    const detrended = new Float64Array(idx.length);
    for (let k = 0; k < idx.length; k++) {
      bucket[k] = plan.bucketOf(dates[idx[k]]);
      detrended[k] = vals[k] - trend[k];
    }

    const seasonalIndex = new Float64Array(plan.buckets);
    if (seasonalPossible) {
      const groups: number[][] = Array.from({ length: plan.buckets }, () => []);
      for (let k = 0; k < idx.length; k++) groups[bucket[k]].push(detrended[k]);
      for (let b = 0; b < plan.buckets; b++) if (groups[b].length >= 2) seasonalIndex[b] = median(groups[b]);
    }

    const resid = new Float64Array(idx.length);
    for (let k = 0; k < idx.length; k++) resid[k] = detrended[k] - seasonalIndex[bucket[k]];
    const { center, scale } = robustScale(finite(resid));
    if (!(scale > 0)) continue;

    for (let k = 0; k < idx.length; k++) {
      const rz = (resid[k] - center) / scale;
      if (Math.abs(rz) < t) continue;
      const fitted = trend[k] + seasonalIndex[bucket[k]] + center;
      const expected = tf.inv(fitted);
      const x = original[k];
      findings.push(
        makeFinding(sheet, idx[k], 'seasonal', {
          column: name,
          value: x,
          score: strength(Math.abs(rz), t) * materiality(rz < 0, tf.log),
          expected: { center: expected, low: tf.inv(fitted - t * scale), high: tf.inv(fitted + t * scale) },
          reason: seasonalPossible
            ? `${fmt(x)} vs. about ${fmt(expected)} expected for ${plan.bucketName(bucket[k])}, given the ${plan.label} pattern and recent trend.`
            : `${fmt(x)} vs. about ${fmt(expected)} expected from the recent trend (not enough history yet for ${plan.label} seasonality).`,
        }),
      );
    }
  }
  return { findings };
};
