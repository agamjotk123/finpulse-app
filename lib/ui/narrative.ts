import { DETECTOR_COUNT } from '@/lib/engine/types';
import type { AnalysisResult } from '@/lib/engine/types';
import { fmtInt } from './format';
import { EMPTY_REVIEW, type Reviews } from './review';

/** The executive summary, written from the results. Plain sentences a CFO can read in 20 seconds. */
export function buildNarrative(result: AnalysisResult, reviews: Reviews): string[] {
  const s = result.summary;
  const out: string[] = [];
  const share = s.totalRows ? ((s.flaggedRows / s.totalRows) * 100).toFixed(1) : '0';
  const sheets = result.workbook.sheets.length;

  out.push(
    `FinPulse scanned ${fmtInt(s.totalRows)} rows${sheets > 1 ? ` across ${sheets} sheets` : ''} of ${result.workbook.fileName} with ${DETECTOR_COUNT} detection models. ` +
      (s.flaggedRows
        ? `${fmtInt(s.flaggedRows)} rows (${share}%) were flagged for review, including ${fmtInt(s.bySeverity.critical)} critical and ${fmtInt(s.bySeverity.high)} high-risk rows.`
        : 'No rows crossed the configured risk thresholds.'),
  );

  if (result.patterns.length) {
    const p = result.patterns[0];
    out.push(
      `The most significant finding is a pattern rather than a single row: ${p.title}. ${p.detail}` +
        (result.patterns.length > 1 ? ` ${result.patterns.length - 1} further pattern${result.patterns.length > 2 ? 's were' : ' was'} also found.` : ''),
    );
  } else if (result.rowRisks.length) {
    const top = result.rowRisks[0];
    out.push(`The highest-risk entry is Excel row ${top.excelRow}${sheets > 1 ? ` in ${top.sheet}` : ''} (score ${top.riskScore}): ${top.findings[0].reason}`);
  }

  const failing = result.benford.filter((b) => b.conformity === 'nonconforming' || b.conformity === 'marginal');
  if (failing.length) {
    out.push(
      `Benford's Law: ${failing.map((b) => `${b.column} (digit ${b.excessDigit} over-represented)`).join(', ')} ${failing.length > 1 ? 'do' : 'does'} not follow the leading-digit pattern of naturally occurring amounts, which can indicate estimated, capped or fabricated values.`,
    );
  }

  const counts = { open: 0, confirmed: 0, explained: 0, dismissed: 0 };
  for (const r of result.rowRisks) counts[(reviews[r.key] ?? EMPTY_REVIEW).status]++;
  const reviewed = counts.confirmed + counts.explained + counts.dismissed;
  if (result.rowRisks.length) {
    out.push(
      reviewed
        ? `Review status: ${fmtInt(counts.confirmed)} confirmed as issues, ${fmtInt(counts.explained)} explained, ${fmtInt(counts.dismissed)} marked as false alarms, and ${fmtInt(counts.open)} still open.`
        : `None of the flagged rows have been reviewed yet.`,
    );
  }
  return out;
}
