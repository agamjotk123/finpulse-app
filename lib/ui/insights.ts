import { coerceNumber } from '@/lib/engine/coerce';
import type { AnalysisResult, RowRisk } from '@/lib/engine/types';

const PREFERENCE = [/total|gross/i, /amount|value|sum/i, /net|price|cost/i];

/** The column that best represents "money" in a sheet, used for the amount-at-risk figure. */
export function primaryAmountColumn(result: AnalysisResult, sheet: string): { name: string; index: number } | null {
  const meta = result.workbook.sheets.find((s) => s.name === sheet);
  if (!meta) return null;
  const measures = meta.columns.filter((c) => c.analyzable);
  if (!measures.length) return null;
  for (const re of PREFERENCE) {
    const hit = measures.find((c) => re.test(c.name));
    if (hit) return { name: hit.name, index: hit.index };
  }
  let best = measures[0];
  let bestMean = -Infinity;
  for (const c of measures) {
    const s = result.columnStats.find((x) => x.sheet === sheet && x.column === c.name);
    if (s && s.mean > bestMean) {
      bestMean = s.mean;
      best = c;
    }
  }
  return { name: best.name, index: best.index };
}

/** Sum of the money column across critical + high rows. */
export function amountAtRisk(rows: RowRisk[], columnIndex: number): number {
  let sum = 0;
  for (const r of rows) {
    if (r.severity !== 'critical' && r.severity !== 'high') continue;
    const v = coerceNumber(r.values[columnIndex]);
    if (Number.isFinite(v)) sum += Math.abs(v);
  }
  return sum;
}

/** Columns a row was flagged on (including the partner column of a broken relationship). */
export function flaggedColumns(row: RowRisk): Set<string> {
  const out = new Set<string>();
  for (const f of row.findings) {
    if (f.column) out.add(f.column);
    if (f.relatedColumn) out.add(f.relatedColumn);
  }
  return out;
}
