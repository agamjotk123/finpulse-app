import { quantileSorted } from '../stats';
import { analyzableColumns } from './shared';
import type { AnalysisConfig, BenfordConformity, BenfordResult, ParsedSheet } from '../types';

const EXPECTED = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => Math.log10(1 + 1 / d));
const MIN_N = 100;

/**
 * Benford's Law first-digit test with Nigrini's MAD conformity bands — a standard
 * forensic-accounting screen for fabricated or manipulated amounts. Column-level only:
 * it says "this column looks off", not "this row is wrong".
 */
export function benfordAnalysis(sheet: ParsedSheet, cfg: AnalysisConfig): { results: BenfordResult[]; skipped: string[] } {
  const results: BenfordResult[] = [];
  const skipped: string[] = [];
  const cols = analyzableColumns(sheet, cfg.maxColumns);

  for (let c = 0; c < cols.length; c++) {
    const name = cols[c].name;
    const raw = sheet.numeric[name];
    const counts = new Array<number>(9).fill(0);
    let n = 0;
    const kept: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      const x = Math.abs(raw[i]);
      // Nigrini: exclude amounts under 10 — they distort first-digit tests.
      if (!Number.isFinite(x) || x < 10) continue;
      let d = Math.floor(x / Math.pow(10, Math.floor(Math.log10(x))));
      // Guard floating-point edges (log10 of 1000 landing on 2.9999…).
      if (d >= 10) d = 1;
      else if (d < 1) d = 9;
      counts[d - 1]++;
      n++;
      kept.push(x);
    }
    if (n < MIN_N) {
      skipped.push(`${name}: needs ${MIN_N}+ amounts of 10 or more (has ${n}).`);
      continue;
    }
    // Benford only applies to data spanning several orders of magnitude. Measure the spread
    // of the middle 90% so one outlier can't make a narrow column look eligible.
    const sorted = Float64Array.from(kept).sort();
    const spread = quantileSorted(sorted, 0.95) / quantileSorted(sorted, 0.05);
    if (spread < 100) {
      skipped.push(`${name}: most amounts fall in a narrow band (${Math.round(spread)}× from low to high), so Benford's Law doesn't apply.`);
      continue;
    }

    const observed = counts.map((k) => k / n);
    let madSum = 0;
    let chi = 0;
    let excessDigit = 1;
    let excess = -Infinity;
    for (let d = 0; d < 9; d++) {
      const diff = observed[d] - EXPECTED[d];
      madSum += Math.abs(diff);
      chi += (n * diff * diff) / EXPECTED[d];
      if (diff > excess) {
        excess = diff;
        excessDigit = d + 1;
      }
    }
    const mad = madSum / 9;
    const conformity: BenfordConformity =
      mad <= 0.006 ? 'close' : mad <= 0.012 ? 'acceptable' : mad <= 0.015 ? 'marginal' : 'nonconforming';

    results.push({ sheet: sheet.name, column: name, n, observed, expected: EXPECTED.slice(), mad, chiSquare: chi, conformity, excessDigit });
  }
  return { results, skipped };
}
