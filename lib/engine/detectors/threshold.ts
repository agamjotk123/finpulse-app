import { finite, fmt, strength } from '../stats';
import { analyzableColumns, makeFinding, type Detector } from './shared';
import type { Finding, ParsedSheet, Pattern } from '../types';

interface Concentration {
  column: string;
  index: number;
  value: string;
  count: number;
  share: number;
}

/**
 * Is the cluster dominated by one employee / vendor / category far beyond their normal
 * share of the sheet? That turns "something is odd" into "look at K. Nair".
 */
function findConcentration(sheet: ParsedSheet, rows: number[]): Concentration | null {
  let best: (Concentration & { lift: number }) | null = null;
  for (let c = 0; c < sheet.columns.length; c++) {
    const col = sheet.columns[c];
    if (col.role !== 'label') continue;
    const inCluster = new Map<string, number>();
    for (let k = 0; k < rows.length; k++) {
      const v = sheet.rows[rows[k]][col.index];
      if (typeof v !== 'string' || !v.trim()) continue;
      inCluster.set(v, (inCluster.get(v) ?? 0) + 1);
    }
    let topValue = '';
    let topCount = 0;
    inCluster.forEach((n, v) => {
      if (n > topCount) {
        topCount = n;
        topValue = v;
      }
    });
    if (!topValue) continue;
    let overall = 0;
    for (let i = 0; i < sheet.rowCount; i++) if (sheet.rows[i][col.index] === topValue) overall++;
    const share = topCount / rows.length;
    const lift = share / Math.max(overall / sheet.rowCount, 1e-9);
    if (share >= 0.5 && lift >= 2 && (!best || lift * share > best.lift * best.share)) {
      best = { column: col.name, index: col.index, value: topValue, count: topCount, share, lift };
    }
  }
  return best;
}

/** Round limits that commonly gate approvals, purchase orders and card spend. */
const LIMITS = [500, 1_000, 2_000, 2_500, 3_000, 5_000, 10_000, 15_000, 20_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
/** Width of the windows compared just below and just above each limit (8%). */
const BAND = 1.08;
const MIN_CLUSTER = 8;
const MIN_RATIO = 3;

/**
 * Approval-limit clustering. In natural data, about as many amounts fall just below a
 * round number as just above it. When far more sit in the 8% under a limit, someone may be
 * splitting invoices or claims to stay under an approval threshold.
 */
export const detectThresholdClustering: Detector = (sheet, cfg) => {
  const findings: Finding[] = [];
  const patterns: Pattern[] = [];
  const cols = analyzableColumns(sheet, cfg.maxColumns);
  let eligible = 0;

  for (let c = 0; c < cols.length; c++) {
    const name = cols[c].name;
    const raw = sheet.numeric[name];
    const v = finite(raw);
    if (v.length < 50) continue;
    eligible++;

    for (let l = 0; l < LIMITS.length; l++) {
      const limit = LIMITS[l];
      const floor = limit / BAND;
      const ceil = limit * BAND;
      const below: number[] = [];
      let above = 0;
      for (let i = 0; i < raw.length; i++) {
        const x = raw[i];
        if (!(x > 0)) continue;
        if (x >= floor && x < limit) below.push(i);
        else if (x >= limit && x < ceil) above++;
      }
      const ratio = below.length / Math.max(1, above);
      if (below.length < MIN_CLUSTER || ratio < MIN_RATIO) continue;

      const base = strength(ratio, MIN_RATIO);
      const who = findConcentration(sheet, below);
      patterns.push({
        id: `threshold:${sheet.name}:${name}:${limit}`,
        sheet: sheet.name,
        detector: 'threshold',
        title: who
          ? `${who.value}: ${who.count} amounts just under ${fmt(limit)}`
          : `${below.length} amounts just under ${fmt(limit)} in ${name}`,
        detail: who
          ? `${Math.round(who.share * 100)}% of the amounts clustered under this limit come from ${who.column} ${who.value}. Only ${above} amounts fall just above it. This is the pattern of payments split to stay under an approval limit.`
          : `Only ${above} amounts fall just above the limit. This is the pattern of payments split to stay under an approval limit.`,
        rowCount: who ? who.count : below.length,
        excelRows: below.filter((i) => !who || sheet.rows[i][who.index] === who.value).map((i) => sheet.excelRows[i]),
        filter: who ? who.value : `just under ${fmt(limit)}`,
      });
      const pattern = `${below.length} ${name} amounts fall in the 8% below ${fmt(limit)} but only ${above} just above it, a pattern seen when payments are split to avoid approval.`;
      for (let k = 0; k < below.length; k++) {
        const i = below[k];
        const matches = who ? sheet.rows[i][who.index] === who.value : true;
        const whoText = who
          ? matches
            ? ` ${who.count} of them (${Math.round(who.share * 100)}%) come from ${who.column} ${who.value}.`
            : ` Most of them come from ${who.column} ${who.value}; this one does not.`
          : '';
        findings.push(
          makeFinding(sheet, i, 'threshold', {
            column: name,
            value: raw[i],
            // Rows from the concentrated party carry the evidence; everyone else is likely coincidence.
            score: who ? (matches ? Math.min(1, base + 0.1) : base * 0.5) : base,
            expected: { high: limit },
            reason: `${fmt(raw[i])} sits just under ${fmt(limit)}. ${pattern}${whoText}`,
          }),
        );
      }
    }
  }
  return eligible ? { findings, patterns } : { findings, skipped: 'Needs a numeric column with 50+ values.' };
};
