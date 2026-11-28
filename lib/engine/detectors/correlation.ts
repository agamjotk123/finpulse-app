import { finite, fmt, robustScale, strength } from '../stats';
import { analyzableColumns, makeFinding, type Detector } from './shared';
import type { CorrelationMatrix, Finding, ParsedSheet } from '../types';

const MIN_PAIRS = 20;
/**
 * Materiality floor: a break must also be at least 1% of the expected value. Near-perfect
 * relationships (Total = Net + VAT) have tiny residual spread, so without this, cent-level
 * rounding differences looked statistically "extreme".
 */
const MIN_RELATIVE_GAP = 0.01;

/**
 * Pearson matrix for every numeric pair, then — for strongly related pairs — a linear fit
 * whose robust residuals reveal rows that break the relationship
 * (VAT not ≈ 5% of net, cost wildly off from quantity × unit price, etc.).
 */
/** Pairwise-complete Pearson matrix for the analysable columns (also used to group columns). */
export function correlationMatrix(sheet: ParsedSheet, maxColumns: number): CorrelationMatrix {
  const cols = analyzableColumns(sheet, maxColumns);
  const names = cols.map((c) => c.name);
  const r: number[][] = names.map((_, i) => names.map((__, j) => (i === j ? 1 : NaN)));
  for (let a = 0; a < names.length; a++) {
    for (let b = a + 1; b < names.length; b++) {
      const v = pearson(sheet.numeric[names[a]], sheet.numeric[names[b]]);
      r[a][b] = v;
      r[b][a] = v;
    }
  }
  return { sheet: sheet.name, columns: names, r };
}

function pearson(x: Float64Array, y: Float64Array): number {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      n++;
      sx += x[i];
      sy += y[i];
    }
  }
  if (n < 3) return NaN;
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < x.length; i++) {
    if (!(Number.isFinite(x[i]) && Number.isFinite(y[i]))) continue;
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

export const detectCorrelation: Detector = (sheet, cfg) => {
  const cols = analyzableColumns(sheet, cfg.correlation.maxColumns);
  const k = cols.length;
  const names = cols.map((c) => c.name);
  const r: number[][] = names.map((_, i) => names.map((__, j) => (i === j ? 1 : NaN)));
  const matrix = { sheet: sheet.name, columns: names, r };
  if (k < 2) return { findings: [], skipped: 'Needs at least 2 numeric columns.', matrix };

  const findings: Finding[] = [];
  const t = cfg.correlation.residualThreshold;
  const n = sheet.rowCount;

  for (let a = 0; a < k; a++) {
    const xa = sheet.numeric[names[a]];
    for (let b = a + 1; b < k; b++) {
      const xb = sheet.numeric[names[b]];
      let cnt = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < n; i++) {
        if (Number.isFinite(xa[i]) && Number.isFinite(xb[i])) {
          cnt++;
          sx += xa[i];
          sy += xb[i];
        }
      }
      if (cnt < 3) continue;
      const mx = sx / cnt;
      const my = sy / cnt;
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (let i = 0; i < n; i++) {
        if (!(Number.isFinite(xa[i]) && Number.isFinite(xb[i]))) continue;
        const dx = xa[i] - mx;
        const dy = xb[i] - my;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
      if (!(sxx > 0 && syy > 0)) continue;
      const rr = sxy / Math.sqrt(sxx * syy);
      r[a][b] = rr;
      r[b][a] = rr;
      if (Math.abs(rr) < cfg.correlation.minAbsR || cnt < MIN_PAIRS) continue;

      const slope = sxy / sxx;
      const intercept = my - slope * mx;
      const rows = new Int32Array(cnt);
      const resid = new Float64Array(cnt);
      let p = 0;
      for (let i = 0; i < n; i++) {
        if (!(Number.isFinite(xa[i]) && Number.isFinite(xb[i]))) continue;
        rows[p] = i;
        resid[p++] = xb[i] - (intercept + slope * xa[i]);
      }
      const { center, scale } = robustScale(finite(resid));
      if (!(scale > 0)) continue;

      for (let q = 0; q < cnt; q++) {
        const rz = (resid[q] - center) / scale;
        if (Math.abs(rz) < t) continue;
        const i = rows[q];
        const predicted = intercept + slope * xa[i] + center;
        if (Math.abs(xb[i] - predicted) < MIN_RELATIVE_GAP * Math.max(Math.abs(predicted), Math.abs(xb[i]))) continue;
        findings.push(
          makeFinding(sheet, i, 'correlation', {
            column: names[b],
            relatedColumn: names[a],
            value: xb[i],
            score: strength(Math.abs(rz), t),
            expected: { center: predicted, low: predicted - t * scale, high: predicted + t * scale },
            reason: `${names[b]} is ${fmt(xb[i])}, but ${names[a]} = ${fmt(xa[i])} implies about ${fmt(predicted)} (r = ${rr.toFixed(2)} across ${cnt} rows).`,
          }),
        );
      }
    }
  }
  return { findings, matrix };
};
