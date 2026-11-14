'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResult, SeriesPoint } from '@/lib/engine/types';
import { fmtDate, fmtInt, fmtNum } from '@/lib/ui/format';
import { colorForRisk } from '@/lib/ui/severity';

interface Props {
  result: AnalysisResult;
  sheet: string;
  onOpen: (key: string) => void;
}

const H = 340;
const PAD = { top: 16, right: 16, bottom: 34, left: 64 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceLinearTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function logTicks(min: number, max: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= min && v <= max) out.push(v);
    }
  }
  return out.length > 7 ? out.filter((v) => Math.log10(v) % 1 === 0) : out;
}

/** One column over time (or ledger order): normal values in blue, flagged values in red, typical range shaded. */
export function ColumnExplorer({ result, sheet, onOpen }: Props) {
  const series = useMemo(() => result.series.filter((s) => s.sheet === sheet), [result, sheet]);
  const [column, setColumn] = useState(series[0]?.column ?? '');
  const active = series.find((s) => s.column === column) ?? series[0];
  const stats = result.columnStats.find((c) => c.sheet === sheet && c.column === active?.column);
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<SeriesPoint | null>(null);

  const canLog = !!stats && stats.min > 0;
  const skewed = !!stats && canLog && stats.max / Math.max(stats.median, 1e-9) > 20;
  const [logScale, setLogScale] = useState<boolean | null>(null);
  const useLog = canLog && (logScale ?? skewed);

  useEffect(() => {
    setLogScale(null);
    setHover(null);
  }, [column, sheet]);

  const chart = useMemo(() => {
    if (!active || !active.points.length || !stats) return null;
    const pts = active.points;
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const p of pts) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    if (xMax === xMin) xMax = xMin + 1;
    if (yMax === yMin) yMax = yMin + 1;
    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const ty = (v: number) => (useLog ? Math.log10(v) : v);
    const lo = ty(useLog ? yMin : Math.min(0, yMin));
    const hi = ty(yMax);
    const span = hi - lo || 1;
    const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * innerW;
    const sy = (y: number) => PAD.top + innerH - ((ty(y) - lo) / span) * innerH;
    const yTicks = useLog ? logTicks(yMin, yMax) : niceLinearTicks(Math.min(0, yMin), yMax);
    const xTicks = Array.from({ length: 5 }, (_, i) => xMin + ((xMax - xMin) * i) / 4);
    const normal = pts.filter((p) => p.risk === 0);
    const flagged = pts.filter((p) => p.risk > 0).sort((a, b) => a.risk - b.risk);
    const bandTop = sy(Math.max(stats.q3, useLog ? yMin : -Infinity));
    const bandBottom = sy(Math.max(stats.q1, useLog ? yMin : -Infinity));
    return { sx, sy, yTicks, xTicks, normal, flagged, bandTop, bandBottom, innerW };
  }, [active, stats, width, useLog]);

  if (!active || !stats) {
    return <p className="py-10 text-haze">This sheet has no numeric columns to chart.</p>;
  }

  const fmtX = (x: number) => (active.xKind === 'date' ? fmtDate(x) : `Row ${fmtInt(x + 2)}`);
  const facts = [
    { label: 'Median', value: fmtNum(stats.median) },
    { label: 'Typical range', value: `${fmtNum(stats.q1)} to ${fmtNum(stats.q3)}` },
    { label: 'Lowest', value: fmtNum(stats.min) },
    { label: 'Highest', value: fmtNum(stats.max) },
    { label: 'Missing', value: fmtInt(stats.missing) },
    { label: 'Flagged rows', value: fmtInt(stats.flaggedRows), alarm: stats.flaggedRows > 0 },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {series.map((s) => {
          const st = result.columnStats.find((c) => c.sheet === sheet && c.column === s.column);
          const on = s.column === active.column;
          return (
            <button
              key={s.column}
              onClick={() => setColumn(s.column)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse',
                on ? 'border-paper bg-paper text-ink' : 'border-graphite text-paper/80 hover:border-paper/60',
              ].join(' ')}
            >
              {s.column}
              {st && st.flaggedRows > 0 && <span className={on ? 'ml-1.5 text-bolt' : 'ml-1.5 text-bolt/90'}>{st.flaggedRows}</span>}
            </button>
          );
        })}
        {canLog && (
          <label className="ml-auto flex items-center gap-2 text-sm text-haze">
            <input type="checkbox" checked={useLog} onChange={(e) => setLogScale(e.target.checked)} className="accent-pulse" />
            Log scale
          </label>
        )}
      </div>

      <div ref={ref} className="relative mt-5">
        {chart && (
          <svg width={width} height={H} role="img" aria-label={`${active.column} values with flagged rows highlighted`}>
            <rect x={PAD.left} y={chart.bandTop} width={chart.innerW} height={Math.max(1, chart.bandBottom - chart.bandTop)} fill="#1A3CFF" fillOpacity="0.16" />
            <line x1={PAD.left} x2={width - PAD.right} y1={chart.sy(stats.median)} y2={chart.sy(stats.median)} stroke="#8FA3FF" strokeOpacity="0.6" strokeDasharray="4 4" />
            {chart.yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={chart.sy(t)} y2={chart.sy(t)} stroke="#4A4A4A" strokeOpacity="0.45" />
                <text x={PAD.left - 10} y={chart.sy(t)} textAnchor="end" dominantBaseline="middle" className="fill-haze text-[11px] tabular-nums">
                  {fmtNum(t)}
                </text>
              </g>
            ))}
            {chart.xTicks.map((t, i) => (
              <text key={i} x={chart.sx(t)} y={H - 10} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="fill-haze text-[11px]">
                {fmtX(t)}
              </text>
            ))}
            {chart.normal.map((p) => (
              <circle key={p.row} cx={chart.sx(p.x)} cy={chart.sy(p.y)} r={2} fill="#1A3CFF" fillOpacity="0.55" />
            ))}
            {chart.flagged.map((p) => (
              <circle
                key={p.row}
                cx={chart.sx(p.x)}
                cy={chart.sy(p.y)}
                r={3 + p.risk / 22}
                fill={colorForRisk(p.risk)}
                stroke="#04050A"
                strokeWidth={1.5}
                className="cursor-pointer"
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onOpen(`${sheet}\u0000${p.row}`)}
              />
            ))}
          </svg>
        )}
        {hover && chart && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-paper px-2.5 py-1.5 text-xs text-ink shadow-lg"
            style={{ left: chart.sx(hover.x), top: chart.sy(hover.y) - 10 }}
          >
            <span className="font-semibold">Row {hover.excelRow}</span>, {fmtNum(hover.y)}, risk {hover.risk}
          </div>
        )}
        <p className="mt-1 text-xs text-haze">
          Shaded band is the typical range (middle half of values), dashed line is the median. Click a highlighted point to open that row.
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((f) => (
          <div key={f.label} className="border-t border-graphite/70 pt-3">
            <dt className="text-xs text-haze">{f.label}</dt>
            <dd className={['mt-0.5 font-medium tabular-nums', f.alarm ? 'text-bolt' : 'text-paper'].join(' ')}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
