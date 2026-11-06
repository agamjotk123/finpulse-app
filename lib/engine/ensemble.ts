import { DETECTOR_META } from './types';
import type { AnalysisConfig, DetectorId, Finding, ParsedSheet, RowRisk, Severity } from './types';

export function severityFor(score: number): Severity {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Consensus risk score per row.
 *  1. Group evidence by WHICH NUMBER it is about (and treat columns that move together,
 *     like Net / VAT / Total, as one number). Z-score, MAD, IQR, seasonality and an
 *     Isolation Forest driven by the same column are all reacting to one value, so they
 *     share a bucket and only the strongest counts. (Without this, an ordinary quantity
 *     of 1 scored 99 because four models "agreed" about the same number.)
 *  2. Combine independent buckets with a noisy-OR: risk = 1 − Π(1 − evidence).
 * Genuinely different problems in one row (an extreme amount AND a broken VAT
 * relationship AND a duplicate) push risk up fast; one borderline value stays low.
 */
const COLUMN_SCOPED: DetectorId[] = ['zscore', 'modz', 'iqr', 'seasonal'];

/** sheet -> column -> group id. Columns that move in lockstep (|r| ≥ 0.9) share a group. */
export type ColumnGroups = Map<string, Map<string, string>>;

function bucketOf(f: Finding, flaggedColumns: string[], groups: Map<string, string> | undefined): string {
  const col = (name: string) => `col:${groups?.get(name) ?? name}`;
  if (COLUMN_SCOPED.indexOf(f.detector) !== -1 && f.column) return col(f.column);
  if (f.detector === 'iforest') {
    return f.relatedColumn && flaggedColumns.indexOf(f.relatedColumn) !== -1 ? col(f.relatedColumn) : 'multivariate';
  }
  return DETECTOR_META[f.detector].family;
}

export function scoreRows(
  findings: Finding[],
  sheets: Map<string, ParsedSheet>,
  cfg: AnalysisConfig,
  columnGroups: ColumnGroups = new Map(),
): { rows: RowRisk[]; total: number } {
  const groups = new Map<string, Finding[]>();
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const key = `${f.sheet}\u0000${f.row}`;
    const list = groups.get(key);
    if (list) list.push(f);
    else groups.set(key, [f]);
  }

  const rows: RowRisk[] = [];
  groups.forEach((list, key) => {
    const flaggedColumns: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (COLUMN_SCOPED.indexOf(f.detector) !== -1 && f.column && flaggedColumns.indexOf(f.column) === -1) {
        flaggedColumns.push(f.column);
      }
    }
    const buckets = new Map<string, number>();
    const detectors: DetectorId[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const evidence = DETECTOR_META[f.detector].weight * f.score;
      const b = bucketOf(f, flaggedColumns, columnGroups.get(f.sheet));
      if (evidence > (buckets.get(b) ?? 0)) buckets.set(b, evidence);
      if (detectors.indexOf(f.detector) === -1) detectors.push(f.detector);
    }
    let keep = 1;
    buckets.forEach((e) => {
      keep *= 1 - e;
    });
    const riskScore = Math.round((1 - keep) * 100);
    if (riskScore < cfg.minRiskScore) return;

    const first = list[0];
    list.sort((a, b) => b.score - a.score);
    rows.push({
      key,
      sheet: first.sheet,
      row: first.row,
      excelRow: first.excelRow,
      riskScore,
      severity: severityFor(riskScore),
      detectors,
      findings: list,
      values: sheets.get(first.sheet)?.rows[first.row] ?? [],
    });
  });

  rows.sort((a, b) => b.riskScore - a.riskScore || a.sheet.localeCompare(b.sheet) || a.excelRow - b.excelRow);
  const total = rows.length;
  return { rows: rows.length > cfg.maxFlaggedRows ? rows.slice(0, cfg.maxFlaggedRows) : rows, total };
}
