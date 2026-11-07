'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ConfigPatch } from '@/lib/engine/config';
import type { AnalysisConfig, AnalysisResult } from '@/lib/engine/types';
import { useReviews } from '@/hooks/useReviews';
import { ReportPreview } from '@/components/report/ReportPreview';
import type { ReviewStatus, Reviews } from '@/lib/ui/review';
import { track } from '@/lib/analytics';
import { fmtBytes, fmtInt, plural } from '@/lib/ui/format';
import { amountAtRisk, primaryAmountColumn } from '@/lib/ui/insights';
import { ColumnExplorer } from './ColumnExplorer';
import { Forensics } from './Forensics';
import { KpiBar } from './KpiBar';
import { PulseStrip } from './PulseStrip';
import { ReviewTable } from './ReviewTable';
import { RowDrawer } from './RowDrawer';
import { SensitivityPanel } from './SensitivityPanel';

interface Props {
  result: AnalysisResult;
  config: AnalysisConfig;
  updating: boolean;
  onConfigChange: (patch: ConfigPatch) => void;
  onReset: () => void;
  onExportExcel: (reviews: Reviews) => Promise<void>;
}

type Tab = 'queue' | 'columns' | 'forensics';

export function Dashboard({ result, config, updating, onConfigChange, onReset, onExportExcel }: Props) {
  const sheets = result.workbook.sheets;
  const [sheet, setSheet] = useState(() => {
    let best = sheets[0]?.name ?? '';
    let bestCount = -1;
    for (const s of sheets) {
      const n = result.rowRisks.filter((r) => r.sheet === s.name).length;
      if (n > bestCount) {
        bestCount = n;
        best = s.name;
      }
    }
    return best;
  });
  const [tab, setTab] = useState<Tab>('queue');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [navKeys, setNavKeys] = useState<string[]>([]);
  const [presetQuery, setPresetQuery] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [excelState, setExcelState] = useState<'idle' | 'working' | 'error'>('idle');

  const { get: getReview, update: updateReview, reviews } = useReviews(result.workbook.fileName, result.workbook.sizeBytes);

  const meta = sheets.find((s) => s.name === sheet) ?? sheets[0];
  const rows = useMemo(() => result.rowRisks.filter((r) => r.sheet === meta?.name), [result, meta]);
  const amountCol = useMemo(() => (meta ? primaryAmountColumn(result, meta.name) : null), [result, meta]);
  const atRisk = amountCol ? amountAtRisk(rows, amountCol.index) : null;
  const critical = rows.filter((r) => r.severity === 'critical').length;
  const patterns = (result.patterns ?? []).filter((p) => p.sheet === meta?.name);
  const scanSeconds = Object.values(result.timings).reduce((a, b) => a + b, 0) / 1000;
  const reviewed = rows.filter((r) => (reviews[r.key]?.status ?? 'open') !== 'open').length;

  const reviewRow = useCallback(
    (key: string, patch: { status?: ReviewStatus; note?: string }) => {
      updateReview(key, patch);
      if (patch.status) track('row_reviewed', { status: patch.status });
    },
    [updateReview],
  );
  const changeConfig = useCallback(
    (patch: ConfigPatch) => {
      onConfigChange(patch);
      track('sensitivity_changed');
    },
    [onConfigChange],
  );

  const exportExcel = async () => {
    setExcelState('working');
    try {
      await onExportExcel(reviews);
      setExcelState('idle');
    } catch {
      setExcelState('error');
    }
  };
  const closeReport = useCallback(() => setReportOpen(false), []);

  const openRow = useCallback(
    (key: string, ordered?: string[]) => {
      setNavKeys(ordered ?? rows.map((r) => r.key));
      setOpenKey(key);
    },
    [rows],
  );

  const openRowData = openKey ? result.rowRisks.find((r) => r.key === openKey) ?? null : null;
  const pos = openKey ? navKeys.indexOf(openKey) : -1;
  const firstExcelRow = rows.length ? rows[0].excelRow - rows[0].row : (meta?.columns.length ? 2 : 2);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'queue', label: `Review queue` },
    { id: 'columns', label: 'Column explorer' },
    { id: 'forensics', label: 'Forensics' },
  ];

  return (
    <div>
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight text-paper md:text-4xl">{result.workbook.fileName}</h1>
          <p className="mt-1.5 text-sm text-haze">
            {fmtBytes(result.workbook.sizeBytes)}, {plural(sheets.length, 'sheet')}, {plural(result.summary.analyzedColumns, 'numeric column')} analysed
            {reviewed > 0 && `, ${fmtInt(reviewed)} of ${fmtInt(rows.length)} reviewed`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sheets.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-haze">
              Sheet
              <select
                value={meta?.name}
                onChange={(e) => {
                  setSheet(e.target.value);
                  setOpenKey(null);
                }}
                className="rounded-lg border border-graphite bg-ink px-3 py-2 text-sm text-paper focus:border-pulse focus:outline-none"
              >
                {sheets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() => {
              setReportOpen(true);
              track('report_opened');
            }}
            className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Audit report (PDF)
          </button>
          <button
            onClick={exportExcel}
            disabled={excelState === 'working' || updating}
            className="rounded-full border border-paper/70 px-4 py-2 text-sm font-medium text-paper hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
          >
            {excelState === 'working' ? 'Preparing Excel…' : excelState === 'error' ? 'Excel failed, try again' : 'Excel workbook'}
          </button>
          <button
            onClick={onReset}
            className="rounded-full border border-graphite px-4 py-2 text-sm text-paper hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
          >
            Scan another file
          </button>
        </div>
      </section>

      {(meta?.truncated || result.summary.flaggedRowsCapped) && (
        <p className="mt-5 rounded-lg border border-[#FF7A45]/40 bg-[#FF7A45]/10 px-4 py-3 text-sm text-paper">
          {meta?.truncated && `Only the first ${fmtInt(meta.rowCount)} rows of this sheet were analysed, which is your plan's limit. `}
          {result.summary.flaggedRowsCapped && `Showing the ${fmtInt(result.rowRisks.length)} highest-risk rows of ${fmtInt(result.summary.flaggedRows)} flagged. Raise the minimum score to narrow the list.`}
        </p>
      )}

      <section className="mt-10" aria-label="Risk trace">
        <PulseStrip rows={rows} rowCount={meta?.rowCount ?? 0} firstExcelRow={firstExcelRow} selectedKey={openKey} onSelect={(k) => openRow(k)} />
      </section>

      <section className="mt-10">
        <KpiBar
          rowsScanned={meta?.rowCount ?? 0}
          flagged={rows.length}
          critical={critical}
          amountAtRisk={atRisk}
          amountColumn={amountCol?.name ?? null}
          scanSeconds={scanSeconds}
        />
      </section>

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className={updating ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div role="tablist" aria-label="Views" className="flex gap-7 overflow-x-auto whitespace-nowrap border-b border-graphite/70">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={[
                  '-mb-px border-b-2 pb-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse',
                  tab === t.id ? 'border-pulse font-medium text-paper' : 'border-transparent text-haze hover:text-paper',
                ].join(' ')}
              >
                {t.label}
                {t.id === 'queue' && <span className="ml-2 tabular-nums text-haze">{fmtInt(rows.length)}</span>}
              </button>
            ))}
          </div>
          <div className="pt-7" role="tabpanel">
            {tab === 'queue' && patterns.length > 0 && (
              <ul className="mb-8 space-y-3">
                {patterns.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-bolt/40 bg-bolt/[0.07] px-5 py-4">
                    <div className="max-w-2xl">
                      <p className="text-xs font-medium text-bolt">Pattern found</p>
                      <p className="mt-1 text-lg font-semibold leading-snug text-paper">{p.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-paper/75">{p.detail}</p>
                    </div>
                    <button
                      onClick={() => {
                        setPresetQuery(p.filter);
                        track('pattern_opened');
                      }}
                      className="shrink-0 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                    >
                      Show these {fmtInt(p.rowCount)} rows
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {tab === 'queue' && (
              <ReviewTable
                key={presetQuery}
                initialQuery={presetQuery}
                rows={rows}
                getReview={getReview}
                onReview={reviewRow}
                onOpen={openRow}
                selectedKey={openKey}
              />
            )}
            {tab === 'columns' && meta && <ColumnExplorer key={meta.name} result={result} sheet={meta.name} onOpen={(k) => openRow(k)} />}
            {tab === 'forensics' && meta && <Forensics result={result} sheet={meta.name} />}
          </div>
        </main>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <SensitivityPanel config={config} onChange={changeConfig} updating={updating} />
          <p className="mt-10 border-t border-graphite/70 pt-4 text-xs leading-relaxed text-haze">
            Your workbook was analysed on this device. Nothing was uploaded.
          </p>
        </aside>
      </div>

      {reportOpen && <ReportPreview result={result} reviews={reviews} onClose={closeReport} />}

      {openRowData && meta && (
        <RowDrawer
          row={openRowData}
          headers={sheets.find((s) => s.name === openRowData.sheet)?.headers ?? meta.headers}
          review={getReview(openRowData.key)}
          onReview={(patch) => reviewRow(openRowData.key, patch)}
          onClose={() => setOpenKey(null)}
          onPrev={pos > 0 ? () => setOpenKey(navKeys[pos - 1]) : undefined}
          onNext={pos >= 0 && pos < navKeys.length - 1 ? () => setOpenKey(navKeys[pos + 1]) : undefined}
          position={pos >= 0 ? { index: pos, total: navKeys.length } : undefined}
        />
      )}
    </div>
  );
}
