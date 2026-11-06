import type { CellValue } from '@/lib/engine/types';

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const HALF_DAY = 43_200_000;

/** 1,234.5 below 100k, 1.2M above — keeps big amounts readable in tight spaces. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.abs(n) >= 100_000 ? compact.format(n) : plain.format(n);
}

export function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
}

export function fmtCell(v: CellValue): string {
  if (v === null) return '';
  if (typeof v === 'number') return plain.format(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

/** Calendar date that is stable across time zones (see engine/seasonal.ts). */
export function fmtDate(t: number): string {
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t + HALF_DAY);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtInt(n)} ${n === 1 ? one : many}`;
}
