'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { RowRisk } from '@/lib/engine/types';
import { fmtInt } from '@/lib/ui/format';
import { colorForRisk } from '@/lib/ui/severity';

interface Props {
  rows: RowRisk[];
  rowCount: number;
  firstExcelRow: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Off for print, where a half-drawn trace would end up in the PDF. */
  animate?: boolean;
}

const W = 1000;
const H = 140;
const BASE = 104;
const PEAK = 92;
/** About one spike slot per 3.5 screen pixels, so spikes stay distinct on phones. */
const PX_PER_BIN = 3.5;

interface Bin {
  index: number;
  risk: number;
  key: string;
  excelRow: number;
  count: number;
}

/**
 * The ledger drawn as a heart-monitor trace: flat where rows are normal, a spike where a
 * row is flagged. Spike height = risk score. High and critical spikes are drawn in red.
 */
export function PulseStrip({ rows, rowCount, firstExcelRow, selectedKey, onSelect, animate = true }: Props) {
  const [hover, setHover] = useState<Bin | null>(null);
  const clipId = useId().replace(/:/g, '');
  const boxRef = useRef<HTMLElement>(null);
  const [maxBins, setMaxBins] = useState(320);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMaxBins(Math.max(40, Math.min(320, Math.floor(e.contentRect.width / PX_PER_BIN)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { bins, binWidth, trace, alarms } = useMemo(() => {
    const n = Math.max(1, Math.min(rowCount, maxBins));
    const bw = W / n;
    const byBin = new Map<number, Bin>();
    for (const r of rows) {
      const i = Math.min(n - 1, Math.floor((r.row * n) / Math.max(1, rowCount)));
      const cur = byBin.get(i);
      if (!cur) byBin.set(i, { index: i, risk: r.riskScore, key: r.key, excelRow: r.excelRow, count: 1 });
      else {
        cur.count++;
        if (r.riskScore > cur.risk) Object.assign(cur, { risk: r.riskScore, key: r.key, excelRow: r.excelRow });
      }
    }
    const list = Array.from(byBin.values()).sort((a, b) => a.index - b.index);

    const spike = (b: Bin) => {
      const x = b.index * bw;
      const h = (b.risk / 100) * PEAK;
      return [
        [x, BASE],
        [x + bw * 0.2, BASE + 5],
        [x + bw * 0.5, BASE - h],
        [x + bw * 0.78, BASE + 9],
        [x + bw, BASE],
      ];
    };

    let d = `M0 ${BASE}`;
    for (const b of list) {
      for (const [x, y] of spike(b)) d += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L${W} ${BASE}`;

    const red = list
      .filter((b) => b.risk >= 65)
      .map((b) => ({ key: b.key, color: colorForRisk(b.risk), d: 'M' + spike(b).map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') }));

    return { bins: list, binWidth: bw, trace: d, alarms: red };
  }, [rows, rowCount, maxBins]);

  const lastExcelRow = firstExcelRow + rowCount - 1;

  return (
    <figure ref={boxRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-36 w-full md:h-44"
        role="img"
        aria-label={`Risk trace across ${fmtInt(rowCount)} rows with ${fmtInt(rows.length)} flagged`}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={W * f} x2={W * f} y1={8} y2={BASE + 18} stroke="#4A4A4A" strokeOpacity="0.35" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} x2={W} y1={BASE - PEAK * 0.85} y2={BASE - PEAK * 0.85} stroke="#FF2323" strokeOpacity="0.25" strokeDasharray="1 5" vectorEffect="non-scaling-stroke" />
        <defs>
          <clipPath id={clipId}>
            {/* One orchestrated moment: the trace sweeps in like a monitor on first render. */}
            <rect width={W} height={H} className={animate ? 'fp-reveal' : undefined} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
        <path d={trace} fill="none" stroke="#1A3CFF" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {alarms.map((a) => (
          <path
            key={a.key}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth={a.key === selectedKey ? 3.5 : 2.25}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        </g>
        {bins.map((b) => (
          <rect
            key={b.key}
            x={b.index * binWidth - 2}
            y={0}
            width={binWidth + 4}
            height={H}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHover(b)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(b.key)}
          />
        ))}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-paper px-2.5 py-1.5 text-xs font-medium text-ink shadow-lg"
          style={{ left: `${((hover.index + 0.5) * binWidth * 100) / W}%` }}
        >
          Row {hover.excelRow}, risk {hover.risk}
          {hover.count > 1 ? ` (+${hover.count - 1} nearby)` : ''}
        </div>
      )}

      <figcaption className="mt-2 flex justify-between text-xs text-haze">
        <span>Row {fmtInt(firstExcelRow)}</span>
        <span>Ledger order, {fmtInt(rowCount)} rows</span>
        <span>Row {fmtInt(lastExcelRow)}</span>
      </figcaption>
    </figure>
  );
}
