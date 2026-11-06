import * as XLSX from 'xlsx';
import type {
  CellValue,
  ColumnKind,
  ColumnProfile,
  ColumnRole,
  ParsedSheet,
  ParsedWorkbook,
} from './types';
import { coerceNumber } from './coerce';

export { coerceNumber };

/** Numeric columns whose header says "this is a key, not a measurement". */
const ID_HEADER =
  /(^|[^a-z])(id|no|nr|num|number|code|ref|reference|acct|account|invoice|inv|zip|postcode|phone|mobile|sku|ean|iban|swift|pin)([^a-z]|$)/i;
/** Numeric calendar dimensions — analysing "Year" as a measure produces nonsense. */
const DIMENSION_HEADER = /^(year|yr|fy|fiscal ?year|month|mon|week|wk|day|quarter|qtr|q|period)$/i;
const DATE_HEADER = /(date|period|month|day|time|posted|posting|year|week|dt)\b/i;

const MAX_COLUMNS = 512;
const PROFILE_SAMPLE = 5_000;

export interface ParseOptions {
  maxRows: number;
  maxSheets?: number;
}

export function parseWorkbook(buffer: ArrayBuffer, fileName: string, opts: ParseOptions): ParsedWorkbook {
  const t0 = performance.now();
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    dense: true, // far lower memory for large sheets
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetRows: opts.maxRows + 50, // stop reading past the plan limit (+ header slack)
  });

  const sheets: ParsedSheet[] = [];
  const names = wb.SheetNames.slice(0, opts.maxSheets ?? 25);
  for (let i = 0; i < names.length; i++) {
    const ws = wb.Sheets[names[i]];
    if (!ws) continue;
    const sheet = parseSheet(names[i], ws, opts.maxRows);
    if (sheet) sheets.push(sheet);
  }
  return { fileName, sizeBytes: buffer.byteLength, sheets, parseMs: performance.now() - t0 };
}

function parseSheet(name: string, ws: XLSX.WorkSheet, maxRows: number): ParsedSheet | null {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  if (aoa.length < 2) return null;

  const headerIdx = detectHeaderRow(aoa);
  const headerRow = aoa[headerIdx] ?? [];
  const body = aoa.slice(headerIdx + 1);
  const fullRef = ws['!fullref'];
  const truncated = (typeof fullRef === 'string' && fullRef !== ws['!ref']) || body.length > maxRows;
  const data = body.slice(0, maxRows);
  if (!data.length) return null;

  let width = headerRow.length;
  for (let i = 0; i < data.length; i++) if (data[i].length > width) width = data[i].length;
  width = Math.min(width, MAX_COLUMNS);

  const headers = dedupeHeaders(headerRow, width);
  const n = data.length;
  const rows: CellValue[][] = new Array(n);
  const excelRows = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const src = data[i];
    const out: CellValue[] = new Array(width);
    for (let c = 0; c < width; c++) out[c] = toCell(src[c]);
    rows[i] = out;
    excelRows[i] = sheetRowIndex(src, headerIdx + 1 + i) + 1;
  }

  const columns: ColumnProfile[] = [];
  const numeric: Record<string, Float64Array> = {};
  const dateCandidates: { name: string; values: Float64Array; headerHit: boolean }[] = [];

  for (let c = 0; c < width; c++) {
    const colName = headers[c];
    const nums = new Float64Array(n).fill(NaN);
    const times = new Float64Array(n).fill(NaN);
    const headerLooksLikeDate = DATE_HEADER.test(colName);
    const distinct = new Set<string>();
    let filled = 0;
    let numCount = 0;
    let intCount = 0;
    let dateCount = 0;
    let sampled = 0;
    let monotonic = true;
    let prev = -Infinity;

    for (let i = 0; i < n; i++) {
      const raw = data[i][c];
      if (raw === null || raw === undefined || raw === '') continue;
      filled++;
      if (raw instanceof Date) {
        const t = raw.getTime();
        if (Number.isFinite(t)) {
          times[i] = t;
          dateCount++;
        }
      } else {
        const x = coerceNumber(raw);
        if (Number.isFinite(x)) {
          nums[i] = x;
          numCount++;
          if (Number.isInteger(x)) intCount++;
          if (x < prev) monotonic = false;
          prev = x;
        } else if (headerLooksLikeDate && typeof raw === 'string') {
          const t = Date.parse(raw);
          if (Number.isFinite(t)) {
            times[i] = t;
            dateCount++;
          }
        }
      }
      if (sampled < PROFILE_SAMPLE) {
        distinct.add(raw instanceof Date ? String(raw.getTime()) : String(raw));
        sampled++;
      }
    }

    const kind: ColumnKind =
      filled === 0
        ? 'empty'
        : dateCount / filled >= 0.8
          ? 'date'
          : numCount / filled >= 0.8
            ? 'numeric'
            : 'text';
    const uniqueRatio = sampled ? distinct.size / sampled : 0;

    let role: ColumnRole;
    if (kind === 'empty') role = 'empty';
    else if (kind === 'date') role = 'date';
    else if (kind === 'text') role = 'label';
    else if (DIMENSION_HEADER.test(colName.trim())) role = 'dimension';
    else if (
      intCount === numCount &&
      ((ID_HEADER.test(colName) && uniqueRatio > 0.5) || (uniqueRatio > 0.98 && monotonic && numCount > 20))
    )
      role = 'identifier';
    else role = 'measure';

    const analyzable = role === 'measure' && distinct.size >= 3;
    if (analyzable) numeric[colName] = nums;
    if (kind === 'date') dateCandidates.push({ name: colName, values: times, headerHit: headerLooksLikeDate });

    columns.push({ name: colName, index: c, kind, role, filled, uniqueRatio, analyzable });
  }

  const dateCol = dateCandidates.find((d) => d.headerHit) ?? dateCandidates[0] ?? null;

  return {
    name,
    headers,
    headerRowIndex: headerIdx,
    rows,
    excelRows,
    rowCount: n,
    truncated,
    columns,
    dateColumn: dateCol ? dateCol.name : null,
    numeric,
    dates: dateCol ? dateCol.values : null,
  };
}

/** First row (within the top 15) that is mostly text labels — skips report titles above the table. */
function detectHeaderRow(aoa: unknown[][]): number {
  const limit = Math.min(aoa.length - 1, 15);
  for (let r = 0; r < limit; r++) {
    const row = aoa[r] ?? [];
    let filled = 0;
    let text = 0;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v === null || v === undefined || v === '') continue;
      filled++;
      if (typeof v === 'string' && Number.isNaN(coerceNumber(v))) text++;
    }
    if (filled >= 2 && text / filled >= 0.7) return r;
  }
  return 0;
}

function dedupeHeaders(row: unknown[], width: number): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (let c = 0; c < width; c++) {
    const raw = row[c];
    let h = raw === null || raw === undefined ? '' : String(raw).replace(/\s+/g, ' ').trim();
    if (!h) h = `Column ${c + 1}`;
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    out.push(count ? `${h} (${count + 1})` : h);
  }
  return out;
}

function toCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

/** SheetJS tags each row array with its 0-based sheet row (non-enumerable __rowNum__). */
function sheetRowIndex(row: unknown[], fallback: number): number {
  const n = (row as unknown as { __rowNum__?: unknown }).__rowNum__;
  return typeof n === 'number' ? n : fallback;
}
