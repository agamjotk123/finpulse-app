'use client';

import { fmtInt, fmtNum } from '@/lib/ui/format';

interface Props {
  rowsScanned: number;
  flagged: number;
  critical: number;
  amountAtRisk: number | null;
  amountColumn: string | null;
  scanSeconds: number;
}

/** Four figures on hairlines, not four boxes. The numbers are the design. */
export function KpiBar({ rowsScanned, flagged, critical, amountAtRisk, amountColumn, scanSeconds }: Props) {
  const share = rowsScanned ? (flagged / rowsScanned) * 100 : 0;
  const items = [
    { label: 'Rows scanned', value: fmtInt(rowsScanned), note: `in ${scanSeconds.toFixed(2)} seconds` },
    { label: 'Need a second look', value: fmtInt(flagged), note: `${share.toFixed(1)}% of all rows` },
    { label: 'Critical', value: fmtInt(critical), note: critical ? 'Start here' : 'None found', alarm: critical > 0 },
    amountAtRisk !== null && amountColumn
      ? { label: `${amountColumn} in high-risk rows`, value: fmtNum(amountAtRisk), note: 'Critical and high combined' }
      : null,
  ].filter(Boolean) as { label: string; value: string; note: string; alarm?: boolean }[];

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="border-t border-graphite/70 pt-4">
          <dt className="text-sm text-haze">{it.label}</dt>
          <dd
            className={[
              'mt-1 text-4xl font-semibold tabular-nums tracking-tight [font-stretch:118%] md:text-5xl',
              it.alarm ? 'text-bolt' : 'text-paper',
            ].join(' ')}
          >
            {it.value}
          </dd>
          <dd className="mt-1 text-xs text-haze">{it.note}</dd>
        </div>
      ))}
    </dl>
  );
}
