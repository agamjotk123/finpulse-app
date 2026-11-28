'use client';

import { DETECTOR_META, type AnalysisResult, type BenfordConformity, type BenfordResult, type DetectorId } from '@/lib/engine/types';
import { fmtInt } from '@/lib/ui/format';

const CONFORMITY: Record<BenfordConformity, { label: string; color: string; meaning: string }> = {
  close: { label: 'Close fit', color: '#8FA3FF', meaning: 'Leading digits look natural.' },
  acceptable: { label: 'Acceptable', color: '#8FA3FF', meaning: 'Minor deviation, usually harmless.' },
  marginal: { label: 'Marginal', color: '#FF7A45', meaning: 'Worth a sample check.' },
  nonconforming: { label: 'Does not fit', color: '#FF2323', meaning: 'Amounts may be estimated, capped, rounded or invented.' },
};

function BenfordChart({ b }: { b: BenfordResult }) {
  const W = 300;
  const H = 120;
  const max = Math.max(...b.observed, ...b.expected) * 1.1;
  const bw = W / 9;
  const y = (v: number) => H - (v / max) * H;
  const c = CONFORMITY[b.conformity];
  return (
    <figure className="border-t border-graphite/70 pt-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-paper">{b.column}</span>
        <span className="text-sm" style={{ color: c.color }}>{c.label}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full" role="img" aria-label={`First-digit distribution of ${b.column} compared with Benford's Law`}>
        {b.observed.map((v, i) => (
          <rect
            key={i}
            x={i * bw + bw * 0.18}
            y={y(v)}
            width={bw * 0.64}
            height={H - y(v)}
            fill={i + 1 === b.excessDigit && (b.conformity === 'nonconforming' || b.conformity === 'marginal') ? '#FF2323' : '#1A3CFF'}
            rx={1.5}
          />
        ))}
        <polyline
          points={b.expected.map((v, i) => `${i * bw + bw / 2},${y(v)}`).join(' ')}
          fill="none"
          stroke="#EDEEF2"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        {b.expected.map((v, i) => (
          <circle key={i} cx={i * bw + bw / 2} cy={y(v)} r={2.2} fill="#EDEEF2" />
        ))}
        {b.observed.map((_, i) => (
          <text key={i} x={i * bw + bw / 2} y={H + 14} textAnchor="middle" className="fill-haze text-[10px]">
            {i + 1}
          </text>
        ))}
      </svg>
      <p className="mt-2 text-xs leading-relaxed text-haze">
        {c.meaning} {fmtInt(b.n)} amounts. Digit {b.excessDigit} appears more often than expected.
      </p>
    </figure>
  );
}

function Heatmap({ columns, r }: { columns: string[]; r: number[][] }) {
  const cell = (v: number) => {
    if (!Number.isFinite(v)) return { background: 'transparent', color: '#6B707C' };
    const a = Math.min(1, Math.abs(v));
    return {
      background: v >= 0 ? `rgba(26,60,255,${0.08 + a * 0.82})` : `rgba(237,238,242,${0.05 + a * 0.35})`,
      color: a > 0.55 ? '#FFFFFF' : '#C9CCD4',
    };
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} scope="col" className="max-w-[88px] truncate px-1 pb-1 text-left font-normal text-haze" title={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((row, i) => (
            <tr key={row}>
              <th scope="row" className="max-w-[120px] truncate pr-2 text-right font-normal text-haze" title={row}>
                {row}
              </th>
              {columns.map((col, j) => (
                <td key={col} className="h-11 w-[72px] rounded text-center tabular-nums" style={cell(r[i][j])} title={`${row} vs ${col}`}>
                  {Number.isFinite(r[i][j]) ? r[i][j].toFixed(2) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The forensic layer: what each model found, Benford's Law, and how columns move together. */
export function Forensics({ result, sheet }: { result: AnalysisResult; sheet: string }) {
  const counts = result.summary.byDetector;
  const ids = Object.keys(DETECTOR_META) as DetectorId[];
  const maxCount = Math.max(1, ...ids.map((d) => counts[d] ?? 0));
  const benford = result.benford.filter((b) => b.sheet === sheet);
  const matrix = result.correlations.find((m) => m.sheet === sheet);
  const skipped = result.summary.skipped.filter((s) => s.sheet === sheet);

  return (
    <div className="space-y-14">
      <section>
        <h3 className="text-lg font-semibold text-paper">What each model found</h3>
        <p className="mt-1 max-w-prose text-sm text-haze">
          Signals before they are combined into one risk score per row. A row flagged by several independent models is more likely to be a real problem.
        </p>
        <ul className="mt-5 space-y-3">
          {ids.map((id) => {
            const n = counts[id] ?? 0;
            const off = !result.config.modules[id];
            return (
              <li key={id} className="grid grid-cols-[140px_1fr_56px] items-center gap-4 text-sm sm:grid-cols-[180px_1fr_64px]">
                <span className={off ? 'text-haze line-through' : 'text-paper'} title={DETECTOR_META[id].description}>
                  {DETECTOR_META[id].label}
                </span>
                <span className="h-2 rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-pulse" style={{ width: `${(n / maxCount) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-haze">{off ? 'Off' : fmtInt(n)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-paper">Benford&apos;s Law</h3>
        <p className="mt-1 max-w-prose text-sm text-haze">
          In genuine financial data, about 30% of amounts start with 1 and under 5% start with 9. Bars show your data; the dotted line shows the natural pattern.
        </p>
        {benford.length ? (
          <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {benford.map((b) => (
              <BenfordChart key={b.column} b={b} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-haze">This test needs 100+ amounts that range widely, like 10 to 100,000. No column here qualifies, which is normal for ledgers of similar-sized transactions.</p>
        )}
      </section>

      {matrix && matrix.columns.length > 1 && (
        <section>
          <h3 className="text-lg font-semibold text-paper">How columns move together</h3>
          <p className="mt-1 max-w-prose text-sm text-haze">
            1.00 means two columns rise and fall in lockstep, like Net and VAT. Rows that break a strong relationship are flagged as relationship breaks.
          </p>
          <div className="mt-5">
            <Heatmap columns={matrix.columns} r={matrix.r} />
          </div>
        </section>
      )}

      {skipped.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-paper">Checks that could not run on this sheet</h3>
          <ul className="mt-2 space-y-1 text-sm text-haze">
            {skipped.map((s, i) => (
              <li key={i}>
                {s.module === 'benford' ? "Benford's Law" : DETECTOR_META[s.module].label}: {s.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
