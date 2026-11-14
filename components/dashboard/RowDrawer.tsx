'use client';

import { useEffect, useRef } from 'react';
import { DETECTOR_COUNT, DETECTOR_META, type RowRisk } from '@/lib/engine/types';
import { fmtCell, fmtNum } from '@/lib/ui/format';
import { flaggedColumns } from '@/lib/ui/insights';
import { REVIEW_LABEL, REVIEW_STATUSES, type Review, type ReviewStatus } from '@/lib/ui/review';
import { SEVERITY_LABEL } from '@/lib/ui/severity';
import { RiskBadge } from './RiskBadge';

interface Props {
  row: RowRisk;
  headers: string[];
  review: Review;
  onReview: (patch: { status?: ReviewStatus; note?: string }) => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
}

/** Everything about one flagged row: why, what was expected, the full record, and the reviewer's decision. */
export function RowDrawer({ row, headers, review, onReview, onClose, onPrev, onNext, position }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const flagged = flaggedColumns(row);

  useEffect(() => {
    closeRef.current?.focus();
  }, [row.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (e.key === 'Escape') onClose();
      if (typing) return;
      if (e.key === 'ArrowDown' || e.key === 'j') onNext?.();
      if (e.key === 'ArrowUp' || e.key === 'k') onPrev?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Row ${row.excelRow} details`}>
      <button className="absolute inset-0 bg-black/60" aria-label="Close details" onClick={onClose} tabIndex={-1} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-graphite bg-ink shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-graphite/70 bg-ink/95 px-6 py-4 backdrop-blur">
          <div className="text-sm text-haze">
            {position ? `${position.index + 1} of ${position.total}` : row.sheet}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrev} disabled={!onPrev} className="rounded-md border border-graphite px-3 py-1.5 text-sm text-paper disabled:opacity-30 hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
              Previous
            </button>
            <button onClick={onNext} disabled={!onNext} className="rounded-md border border-graphite px-3 py-1.5 text-sm text-paper disabled:opacity-30 hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
              Next
            </button>
            <button ref={closeRef} onClick={onClose} className="ml-1 rounded-md px-3 py-1.5 text-sm text-paper hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
              Close
            </button>
          </div>
        </header>

        <div className="space-y-9 px-6 py-7">
          <section>
            <h2 className="text-3xl font-semibold tracking-tight text-paper">Row {row.excelRow}</h2>
            <p className="mt-1 text-sm text-haze">
              {SEVERITY_LABEL[row.severity]} risk in {row.sheet}, flagged by {row.detectors.length} of {DETECTOR_COUNT} models
            </p>
            <div className="mt-5">
              <RiskBadge score={row.riskScore} severity={row.severity} size="lg" />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-paper">Why it was flagged</h3>
            <ol className="mt-3 space-y-4">
              {row.findings.map((f) => (
                <li key={f.id} className="border-l-2 pl-4" style={{ borderColor: f.score >= 0.8 ? '#FF2323' : '#1A3CFF' }}>
                  <p className="text-xs text-haze">{DETECTOR_META[f.detector].label}</p>
                  <p className="mt-0.5 leading-relaxed text-paper/90">{f.reason}</p>
                  {f.expected && Number.isFinite(f.expected.low) && Number.isFinite(f.expected.high) && (
                    <p className="mt-1 text-xs text-haze">
                      Expected range {fmtNum(f.expected.low as number)} to {fmtNum(f.expected.high as number)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-paper">The full record</h3>
            <dl className="mt-3 divide-y divide-white/[0.06] border-y border-white/[0.06] text-sm">
              {headers.map((h, i) => {
                const hit = flagged.has(h);
                return (
                  <div key={h} className="flex justify-between gap-6 py-2">
                    <dt className={hit ? 'text-bolt' : 'text-haze'}>{h}</dt>
                    <dd className={['text-right tabular-nums', hit ? 'font-semibold text-bolt' : 'text-paper'].join(' ')}>
                      {fmtCell(row.values[i] ?? null) || '—'}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-paper">Your review</h3>
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Review status">
              {REVIEW_STATUSES.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={review.status === s}
                  onClick={() => onReview({ status: s })}
                  className={[
                    'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse',
                    review.status === s ? 'border-paper bg-paper font-medium text-ink' : 'border-graphite text-paper hover:border-paper/60',
                  ].join(' ')}
                >
                  {REVIEW_LABEL[s]}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm text-haze" htmlFor="review-note">
              Note for the audit report
            </label>
            <textarea
              id="review-note"
              key={row.key}
              defaultValue={review.note}
              onChange={(e) => onReview({ note: e.target.value })}
              rows={3}
              placeholder="e.g. Approved by CFO, see email of 3 March"
              className="mt-1.5 w-full rounded-lg border border-graphite bg-transparent px-3.5 py-2.5 text-sm text-paper placeholder:text-haze/70 focus:border-pulse focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-haze">Saved automatically, only in this browser. Use the arrow keys to move between rows.</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
