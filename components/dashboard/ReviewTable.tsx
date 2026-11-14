'use client';

import { useMemo, useState } from 'react';
import { DETECTOR_COUNT, DETECTOR_META, type RowRisk, type Severity } from '@/lib/engine/types';
import { fmtCell, fmtInt } from '@/lib/ui/format';
import { REVIEW_LABEL, REVIEW_STATUSES, type Review, type ReviewStatus } from '@/lib/ui/review';
import { SEVERITIES, SEVERITY_COLOR, SEVERITY_LABEL } from '@/lib/ui/severity';
import { RiskBadge } from './RiskBadge';

interface Props {
  rows: RowRisk[];
  getReview: (key: string) => Review;
  onReview: (key: string, patch: { status?: ReviewStatus; note?: string }) => void;
  onOpen: (key: string, orderedKeys: string[]) => void;
  selectedKey: string | null;
  initialQuery?: string;
}

const PAGE = 25;
type StatusFilter = ReviewStatus | 'all';

export function ReviewTable({ rows, getReview, onReview, onOpen, selectedKey, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of rows) c[r.severity]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (severity !== 'all' && r.severity !== severity) return false;
      if (status !== 'all' && getReview(r.key).status !== status) return false;
      if (!q) return true;
      if (String(r.excelRow) === q) return true;
      if (r.findings.some((f) => f.reason.toLowerCase().includes(q))) return true;
      return r.values.some((v) => fmtCell(v).toLowerCase().includes(q));
    });
  }, [rows, query, severity, status, getReview]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const orderedKeys = filtered.map((r) => r.key);

  const chip = (active: boolean) =>
    [
      'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse',
      active ? 'border-paper bg-paper text-ink' : 'border-graphite text-paper/80 hover:border-paper/60',
    ].join(' ');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={chip(severity === 'all')} onClick={() => { setSeverity('all'); setPage(0); }}>
          All {fmtInt(rows.length)}
        </button>
        {SEVERITIES.map((s) => (
          <button key={s} className={chip(severity === s)} onClick={() => { setSeverity(s); setPage(0); }} disabled={!counts[s]}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
            {SEVERITY_LABEL[s]} {fmtInt(counts[s])}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search flagged rows</span>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search by row number, vendor, amount or reason"
            className="w-full rounded-lg border border-graphite bg-transparent px-3.5 py-2.5 text-sm text-paper placeholder:text-haze focus:border-pulse focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-haze">
          Status
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(0); }}
            className="rounded-lg border border-graphite bg-ink px-3 py-2.5 text-sm text-paper focus:border-pulse focus:outline-none"
          >
            <option value="all">Any</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{REVIEW_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-graphite/70 text-haze">
              <th scope="col" className="py-2.5 pr-3 font-normal">Risk</th>
              <th scope="col" className="py-2.5 pr-3 font-normal">Row</th>
              <th scope="col" className="py-2.5 pr-3 font-normal">What stands out</th>
              <th scope="col" className="py-2.5 pr-3 font-normal">Signals</th>
              <th scope="col" className="py-2.5 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const review = getReview(r.key);
              const done = review.status !== 'open';
              return (
                <tr
                  key={r.key}
                  onClick={() => onOpen(r.key, orderedKeys)}
                  className={[
                    'cursor-pointer border-b border-white/[0.06] align-top transition-colors hover:bg-white/[0.035]',
                    r.key === selectedKey ? 'bg-pulse/10' : '',
                    done ? 'opacity-55' : '',
                  ].join(' ')}
                >
                  <td className="py-3.5 pr-3"><RiskBadge score={r.riskScore} severity={r.severity} /></td>
                  <td className="py-3.5 pr-3 tabular-nums text-paper">
                    <button
                      className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
                      onClick={(e) => { e.stopPropagation(); onOpen(r.key, orderedKeys); }}
                    >
                      {r.excelRow}
                    </button>
                  </td>
                  <td className="max-w-[520px] py-3.5 pr-3 leading-relaxed text-paper/85">
                    {r.findings[0].reason}
                    {review.note && <span className="mt-1 block text-xs text-haze">Note: {review.note}</span>}
                  </td>
                  <td className="py-3.5 pr-3 text-haze" title={r.detectors.map((d) => DETECTOR_META[d].label).join(', ')}>
                    {r.detectors.length} of {DETECTOR_COUNT}
                  </td>
                  <td className="py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      aria-label={`Status for row ${r.excelRow}`}
                      value={review.status}
                      onChange={(e) => onReview(r.key, { status: e.target.value as ReviewStatus })}
                      className="rounded-md border border-graphite bg-ink px-2 py-1.5 text-sm text-paper focus:border-pulse focus:outline-none"
                    >
                      {REVIEW_STATUSES.map((s) => (
                        <option key={s} value={s}>{REVIEW_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && (
          <p className="py-10 text-center text-haze">
            {rows.length ? 'No rows match these filters. Clear the search or pick another severity.' : 'Nothing crossed your thresholds. Try the Thorough sensitivity to see weaker signals.'}
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-haze" aria-label="Pages">
          <span>
            {fmtInt(current * PAGE + 1)} to {fmtInt(Math.min(filtered.length, (current + 1) * PAGE))} of {fmtInt(filtered.length)}
          </span>
          <span className="flex gap-2">
            <button className={chip(false)} disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
            <button className={chip(false)} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
          </span>
        </nav>
      )}
    </div>
  );
}
