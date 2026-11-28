import { BrandMark } from '@/components/brand/BrandMark';
import { PulseStrip } from '@/components/dashboard/PulseStrip';
import { DETECTOR_COUNT, DETECTOR_META, type AnalysisResult, type DetectorId, type RowRisk } from '@/lib/engine/types';
import { fmtInt, fmtNum, plural } from '@/lib/ui/format';
import { amountAtRisk, primaryAmountColumn } from '@/lib/ui/insights';
import { buildNarrative } from '@/lib/ui/narrative';
import { EMPTY_REVIEW, REVIEW_LABEL, type Reviews, type ReviewStatus } from '@/lib/ui/review';
import { SEVERITY_COLOR } from '@/lib/ui/severity';

interface Props {
  result: AnalysisResult;
  reviews: Reviews;
  preparedBy: string;
}

const MAX_TABLE_ROWS = 150;
const INK = '#0B0C10';
const MUTED = '#5B606C';
const RULE = '#D9DBE1';

const STATUS_COLOR: Record<ReviewStatus, string> = {
  confirmed: '#FF2323',
  explained: '#1A3CFF',
  dismissed: '#9AA0AC',
  open: '#FFFFFF',
};

const BENFORD_LABEL = { close: 'Close fit', acceptable: 'Acceptable', marginal: 'Marginal', nonconforming: 'Does not fit' } as const;

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-9 ${className}`}>
      <h2 className="border-b pb-1.5 text-[13pt] font-semibold" style={{ borderColor: INK, color: INK }}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The printable A4 audit report. Plain, dense, signable: built for auditors, not for screens. */
export function AuditReport({ result, reviews, preparedBy }: Props) {
  const s = result.summary;
  const review = (k: string) => reviews[k] ?? EMPTY_REVIEW;
  const multi = result.workbook.sheets.length > 1;
  const generated = new Date(result.generatedAt);
  const narrative = buildNarrative(result, reviews);

  let money: { label: string; value: number } | null = null;
  const firstSheet = result.workbook.sheets[0];
  if (!multi && firstSheet) {
    const col = primaryAmountColumn(result, firstSheet.name);
    if (col) money = { label: `${col.name} in high-risk rows`, value: amountAtRisk(result.rowRisks, col.index) };
  }

  const counts: Record<ReviewStatus, number> = { confirmed: 0, explained: 0, dismissed: 0, open: 0 };
  for (const r of result.rowRisks) counts[review(r.key).status]++;
  const totalFlagged = result.rowRisks.length || 1;

  // Rows explained entirely by a pattern are listed under that pattern, not repeated in the table.
  const inPattern = new Set<string>();
  for (const p of result.patterns) for (const row of p.excelRows ?? []) inPattern.add(`${p.sheet}\u0000${row}`);
  const patternOnly = (r: RowRisk) =>
    inPattern.has(`${r.sheet}\u0000${r.excelRow}`) && r.findings.every((f) => f.detector === 'threshold');
  const collapsed = result.rowRisks.filter(patternOnly).length;
  const serious = result.rowRisks.filter((r) => (r.severity === 'critical' || r.severity === 'high') && !patternOnly(r));
  const tableRows: RowRisk[] = (serious.length ? serious : result.rowRisks.filter((r) => !patternOnly(r)).slice(0, 25)).slice(0, MAX_TABLE_ROWS);
  const collapsedNote = collapsed ? ` ${plural(collapsed, 'row')} belonging to the patterns above ${collapsed === 1 ? 'is' : 'are'} listed there instead.` : '';
  const tableNote =
    (serious.length > MAX_TABLE_ROWS
      ? `Showing the ${MAX_TABLE_ROWS} highest-risk of ${fmtInt(serious.length)} critical and high rows. The Excel export lists all of them.`
      : serious.length
        ? `All ${fmtInt(serious.length)} critical and high-risk rows.`
        : 'No other critical or high-risk rows. Showing the highest-scoring flagged rows.') + collapsedNote;

  const figures = [
    { label: 'Rows scanned', value: fmtInt(s.totalRows) },
    { label: 'Rows flagged', value: fmtInt(s.flaggedRows) },
    { label: 'Critical', value: fmtInt(s.bySeverity.critical), alarm: s.bySeverity.critical > 0 },
    money ? { label: money.label, value: fmtNum(money.value) } : { label: 'High', value: fmtInt(s.bySeverity.high) },
  ];

  const ids = Object.keys(DETECTOR_META) as DetectorId[];

  return (
    <article className="fp-report text-[9.5pt] leading-[1.45]" style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>
      <header className="flex items-center justify-between border-b pb-4" style={{ borderColor: RULE }}>
        <div className="flex items-center gap-2.5">
          <BrandMark size={34} variant="mini" />
          <span className="text-[12pt] font-semibold">Benfora</span>
        </div>
        <div className="text-right text-[8.5pt]" style={{ color: MUTED }}>
          Anomaly audit report
          <br />
          {generated.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}
        </div>
      </header>

      <h1 className="mt-7 break-words text-[22pt] font-semibold leading-tight tracking-tight [font-stretch:110%]">{result.workbook.fileName}</h1>
      <p className="mt-1.5" style={{ color: MUTED }}>
        {multi ? `${result.workbook.sheets.length} sheets, ` : ''}
        {fmtInt(s.totalRows)} rows, {plural(s.analyzedColumns, 'numeric column')} analysed
        {preparedBy ? `. Prepared by ${preparedBy}` : ''}.
      </p>

      <Section title="Summary">
        <div className="grid grid-cols-4 gap-5">
          {figures.map((f) => (
            <div key={f.label} className="border-t pt-2" style={{ borderColor: RULE }}>
              <div className="text-[8pt]" style={{ color: MUTED }}>{f.label}</div>
              <div className="text-[20pt] font-semibold leading-tight [font-stretch:115%]" style={{ color: f.alarm ? '#E01818' : INK }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2.5">
          {narrative.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {result.rowRisks.length > 0 && (
          <div className="fp-avoid-break mt-5">
            <div className="text-[8pt]" style={{ color: MUTED }}>Review progress</div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full border" style={{ borderColor: RULE }}>
              {(['confirmed', 'explained', 'dismissed', 'open'] as ReviewStatus[]).map((st) => (
                <span key={st} style={{ width: `${(counts[st] / totalFlagged) * 100}%`, background: STATUS_COLOR[st] }} />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[8pt]" style={{ color: MUTED }}>
              {(['confirmed', 'explained', 'dismissed', 'open'] as ReviewStatus[]).map((st) => (
                <span key={st} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full border" style={{ background: STATUS_COLOR[st], borderColor: st === 'open' ? MUTED : STATUS_COLOR[st] }} />
                  {REVIEW_LABEL[st]} {fmtInt(counts[st])}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {result.patterns.length > 0 && (
        <Section title="Patterns found">
          <ul className="space-y-3">
            {result.patterns.map((p) => (
              <li key={p.id} className="fp-avoid-break border-l-[3px] pl-3" style={{ borderColor: '#FF2323' }}>
                <p className="font-semibold">{p.title}{multi ? ` (${p.sheet})` : ''}</p>
                <p className="mt-0.5" style={{ color: MUTED }}>{p.detail}</p>
                {p.excelRows?.length > 0 && (
                  <p className="mt-1.5 text-[7.5pt] leading-snug" style={{ color: MUTED }}>
                    Excel rows ({fmtInt(p.excelRows.length)}): {p.excelRows.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Risk across the ledger" className="fp-avoid-break">
        {result.workbook.sheets.map((sh) => {
          const rows = result.rowRisks.filter((r) => r.sheet === sh.name);
          return (
            <div key={sh.name} className="mt-2 rounded-md bg-[#04050A] px-4 pb-2 pt-3">
              {multi && <div className="mb-1 text-[8pt] text-[#C9CCD4]">{sh.name}</div>}
              <PulseStrip
                rows={rows}
                rowCount={sh.rowCount}
                firstExcelRow={rows.length ? rows[0].excelRow - rows[0].row : 2}
                selectedKey={null}
                onSelect={() => {}}
                animate={false}
              />
            </div>
          );
        })}
        <p className="mt-1.5 text-[8pt]" style={{ color: MUTED }}>
          Each spike is a flagged row; its height is the risk score. Red spikes are high or critical.
        </p>
      </Section>

      <Section title="Rows that need attention">
        <p className="mb-2 text-[8pt]" style={{ color: MUTED }}>{tableNote}</p>
        <table className="w-full border-collapse text-left text-[8.5pt]">
          <thead>
            <tr className="border-b" style={{ borderColor: INK }}>
              <th className="w-10 py-1.5 pr-2 font-semibold">Risk</th>
              {multi && <th className="py-1.5 pr-2 font-semibold">Sheet</th>}
              <th className="w-12 py-1.5 pr-2 font-semibold">Row</th>
              <th className="py-1.5 pr-2 font-semibold">Finding</th>
              <th className="w-[22%] py-1.5 font-semibold">Review</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => {
              const rv = review(r.key);
              return (
                <tr key={r.key} className="border-b align-top" style={{ borderColor: RULE, breakInside: 'avoid' }}>
                  <td className="py-1.5 pr-2 font-semibold" style={{ color: SEVERITY_COLOR[r.severity] === '#8FA3FF' ? '#3550FF' : SEVERITY_COLOR[r.severity] }}>
                    {r.riskScore}
                  </td>
                  {multi && <td className="py-1.5 pr-2">{r.sheet}</td>}
                  <td className="py-1.5 pr-2">{r.excelRow}</td>
                  <td className="py-1.5 pr-2">
                    {r.findings[0].reason}
                    {r.findings.length > 1 && (
                      <span style={{ color: MUTED }}> Also flagged by {r.detectors.filter((d) => d !== r.findings[0].detector).map((d) => DETECTOR_META[d].label).join(', ')}.</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    <span className={rv.status === 'open' ? '' : 'font-medium'}>{REVIEW_LABEL[rv.status]}</span>
                    {rv.note && <span className="block" style={{ color: MUTED }}>{rv.note}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {result.benford.length > 0 && (
        <Section title="Benford's Law" className="fp-avoid-break">
          <table className="w-full border-collapse text-left text-[8.5pt]">
            <thead>
              <tr className="border-b" style={{ borderColor: INK }}>
                <th className="py-1.5 pr-2 font-semibold">Column</th>
                <th className="py-1.5 pr-2 font-semibold">Amounts tested</th>
                <th className="py-1.5 pr-2 font-semibold">Fit</th>
                <th className="py-1.5 pr-2 font-semibold">Deviation (MAD)</th>
                <th className="py-1.5 font-semibold">Most over-represented digit</th>
              </tr>
            </thead>
            <tbody>
              {result.benford.map((b) => (
                <tr key={`${b.sheet}:${b.column}`} className="border-b" style={{ borderColor: RULE }}>
                  <td className="py-1.5 pr-2">{multi ? `${b.sheet}: ` : ''}{b.column}</td>
                  <td className="py-1.5 pr-2">{fmtInt(b.n)}</td>
                  <td className="py-1.5 pr-2" style={{ color: b.conformity === 'nonconforming' ? '#E01818' : INK }}>{BENFORD_LABEL[b.conformity]}</td>
                  <td className="py-1.5 pr-2">{b.mad.toFixed(4)}</td>
                  <td className="py-1.5">
                    {b.excessDigit} ({(b.observed[b.excessDigit - 1] * 100).toFixed(1)}% vs {(b.expected[b.excessDigit - 1] * 100).toFixed(1)}% expected)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[8pt]" style={{ color: MUTED }}>Conformity bands follow Nigrini: close up to 0.006, acceptable up to 0.012, marginal up to 0.015.</p>
        </Section>
      )}

      <Section title="Method" className="fp-avoid-break">
        <p>
          Each row was tested by {DETECTOR_COUNT} independent models. Evidence about the same value is counted once, and money-like columns are judged
          on a log scale with low-side deviations discounted for materiality. Independent signals are then combined into one risk score from 0 to 100:
          critical from 85, high from 65, medium from 40. Results are reproducible: the same file and settings always give the same scores
          (Isolation Forest seed {result.config.iforest.seed}).
        </p>
        <table className="mt-3 w-full border-collapse text-left text-[8.5pt]">
          <tbody>
            {ids.map((id) => (
              <tr key={id} className="border-b" style={{ borderColor: RULE }}>
                <td className="w-[28%] py-1 pr-2 font-medium">{DETECTOR_META[id].label}</td>
                <td className="py-1 pr-2" style={{ color: MUTED }}>{DETECTOR_META[id].description}</td>
                <td className="w-20 py-1 text-right">{result.config.modules[id] ? `${fmtInt(s.byDetector[id] ?? 0)} signals` : 'Off'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[8pt]" style={{ color: MUTED }}>
          Settings: minimum risk score {result.config.minRiskScore}; Z-score {result.config.zThreshold}σ; robust MAD {result.config.modZThreshold};
          IQR {result.config.iqrMultiplier}×; Isolation Forest {result.config.iforest.threshold}. The workbook was analysed in the browser and never uploaded.
          Flags indicate entries that warrant review, not proof of error or fraud.
        </p>
      </Section>

      <section className="fp-avoid-break mt-10 grid grid-cols-3 gap-6 text-[8.5pt]">
        {['Reviewed by', 'Signature', 'Date'].map((l) => (
          <div key={l}>
            <div className="h-9 border-b" style={{ borderColor: INK }} />
            <div className="mt-1" style={{ color: MUTED }}>{l}</div>
          </div>
        ))}
      </section>
    </article>
  );
}

