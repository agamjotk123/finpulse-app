import {
  applyTransform,
  chooseTransform,
  finite,
  fmt,
  materiality,
  mean,
  quantileSorted,
  robustScale,
  sortedCopy,
  std,
  strength,
} from '../stats';
import { analyzableColumns, makeFinding, type Detector } from './shared';
import type { Finding } from '../types';

const MIN_N = 8;

/**
 * Z-score. Skew-aware: for positive, right-skewed money columns it is computed on a log
 * scale, otherwise every legitimately large invoice would be "3σ above average".
 */
export const detectZScore: Detector = (sheet, cfg) => {
  const findings: Finding[] = [];
  const t = cfg.zThreshold;
  const cols = analyzableColumns(sheet, cfg.maxColumns);
  for (let c = 0; c < cols.length; c++) {
    const name = cols[c].name;
    const original = sheet.numeric[name];
    const tf = chooseTransform(finite(original));
    const raw = applyTransform(original, tf);
    const v = finite(raw);
    if (v.length < MIN_N) continue;
    const m = mean(v);
    const s = std(v, m);
    if (!(s > 0)) continue;
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      if (!Number.isFinite(x)) continue;
      const z = (x - m) / s;
      if (Math.abs(z) < t) continue;
      const typical = tf.inv(m);
      findings.push(
        makeFinding(sheet, i, 'zscore', {
          column: name,
          value: original[i],
          score: strength(Math.abs(z), t) * materiality(z < 0, tf.log),
          expected: { center: typical, low: tf.inv(m - t * s), high: tf.inv(m + t * s) },
          reason: tf.log
            ? `${fmt(original[i])} is ${(original[i] / typical).toFixed(1)}× the typical ${name} of ${fmt(typical)} (${fmt(Math.abs(z))}σ on a log scale).`
            : `${fmt(original[i])} is ${fmt(Math.abs(z))}σ ${z > 0 ? 'above' : 'below'} the ${name} average of ${fmt(m)}.`,
        }),
      );
    }
  }
  return { findings };
};

/**
 * Modified z-score (Iglewicz & Hoaglin): 0.6745·(x − median)/MAD.
 * Robust to the very outliers we're hunting, so one huge payment can't hide another.
 */
export const detectModifiedZ: Detector = (sheet, cfg) => {
  const findings: Finding[] = [];
  const t = cfg.modZThreshold;
  const cols = analyzableColumns(sheet, cfg.maxColumns);
  for (let c = 0; c < cols.length; c++) {
    const name = cols[c].name;
    const original = sheet.numeric[name];
    const tf = chooseTransform(finite(original));
    const raw = applyTransform(original, tf);
    const v = finite(raw);
    if (v.length < MIN_N) continue;
    // robustScale returns MAD·1.4826, and 0.6745 ≈ 1/1.4826, so (x−med)/scale is the modified z.
    const { center, scale } = robustScale(v);
    if (!(scale > 0)) continue;
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      if (!Number.isFinite(x)) continue;
      const mz = (x - center) / scale;
      if (Math.abs(mz) < t) continue;
      const low = tf.inv(center - t * scale);
      const high = tf.inv(center + t * scale);
      findings.push(
        makeFinding(sheet, i, 'modz', {
          column: name,
          value: original[i],
          score: strength(Math.abs(mz), t) * materiality(mz < 0, tf.log),
          expected: { center: tf.inv(center), low, high },
          reason: `${fmt(original[i])} is unusually ${mz > 0 ? 'high' : 'low'} for ${name}; typical values run ${fmt(low)} to ${fmt(high)}${tf.log ? ' (judged on a log scale, as amounts are skewed)' : ''}.`,
        }),
      );
    }
  }
  return { findings };
};

/** Tukey fences: [Q1 − k·IQR, Q3 + k·IQR]. Distribution-free; good for skewed amounts. */
export const detectIQR: Detector = (sheet, cfg) => {
  const findings: Finding[] = [];
  const k = cfg.iqrMultiplier;
  const cols = analyzableColumns(sheet, cfg.maxColumns);
  for (let c = 0; c < cols.length; c++) {
    const name = cols[c].name;
    const original = sheet.numeric[name];
    const tf = chooseTransform(finite(original));
    const raw = applyTransform(original, tf);
    const sorted = sortedCopy(finite(raw));
    if (sorted.length < MIN_N) continue;
    const q1 = quantileSorted(sorted, 0.25);
    const q3 = quantileSorted(sorted, 0.75);
    const iqr = q3 - q1;
    if (!(iqr > 0)) continue;
    const low = q1 - k * iqr;
    const high = q3 + k * iqr;
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      if (!Number.isFinite(x) || (x >= low && x <= high)) continue;
      const beyond = x > high ? x - high : low - x;
      const lowV = tf.inv(low);
      const highV = tf.inv(high);
      findings.push(
        makeFinding(sheet, i, 'iqr', {
          column: name,
          value: original[i],
          score: strength(k + beyond / iqr, k) * materiality(x < low, tf.log),
          expected: { low: lowV, high: highV, center: tf.inv((q1 + q3) / 2) },
          reason: `${fmt(original[i])} is outside the ${name} fences of ${fmt(lowV)} to ${fmt(highV)}.`,
        }),
      );
    }
  }
  return { findings };
};
