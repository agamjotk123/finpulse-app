import * as XLSX from 'xlsx';
import { DETECTOR_COUNT, DETECTOR_META } from './types';
import type { AnalysisResult, CellValue, ParsedSheet, ParsedWorkbook, RowRisk } from './types';
import { EMPTY_REVIEW, REVIEW_LABEL, type Reviews } from '@/lib/ui/review';

type Cell = string | number | boolean | Date | null;
type Table = Cell[][];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEVERITY_TEXT = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' } as const;

/** Excel sheet names: max 31 chars, no []:*?/\ and unique. */
function sheetName(base: string, used: Set<string>): string {
  const clean = base.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let name = clean;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${clean.slice(0, 27)} (${i})`;
  used.add(name.toLowerCase());
  return name;
}

/** Restores real Excel dates for date columns (the engine stores them as ISO text). */
function restoreCell(v: CellValue, isDateColumn: boolean): Cell {
  if (isDateColumn && typeof v === 'string' && ISO_DATE.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    // Local midnight: SheetJS converts Dates using local time, so this lands on the right day everywhere.
    return new Date(y, m - 1, d);
  }
  return v;
}

function addSheet(book: XLSX.WorkBook, used: Set<string>, title: string, table: Table, opts: { filter?: boolean; widths?: number[] } = {}) {
  const ws = XLSX.utils.aoa_to_sheet(table, { cellDates: true, dateNF: 'yyyy-mm-dd' });
  const cols = table[0]?.length ?? 0;
  ws['!cols'] = Array.from({ length: cols }, (_, c) => {
    if (opts.widths?.[c]) return { wch: opts.widths[c] };
    let w = 8;
    for (let r = 0; r < Math.min(table.length, 200); r++) {
      const v = table[r][c];
      const len = v instanceof Date ? 10 : v === null || v === undefined ? 0 : String(v).length;
      if (len > w) w = len;
    }
    return { wch: Math.min(60, w + 2) };
  });
  if (opts.filter && table.length > 1 && ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
  XLSX.utils.book_append_sheet(book, ws, sheetName(title, used));
}

function dateColumns(sheet: ParsedSheet): Set<number> {
  return new Set(sheet.columns.filter((c) => c.role === 'date').map((c) => c.index));
}

/**
 * Builds the downloadable audit workbook:
 *   Summary · Patterns · Flagged rows (per sheet) · All findings · Original data + risk columns.
 * Runs in the Web Worker, so even large workbooks never freeze the page or leave the device.
 */
export function buildExcelExport(wb: ParsedWorkbook, result: AnalysisResult, reviews: Reviews): { buffer: ArrayBuffer; fileName: string } {
  const book = XLSX.utils.book_new();
  const used = new Set<string>();
  const review = (key: string) => reviews[key] ?? EMPTY_REVIEW;
  const s = result.summary;
  const counts = { open: 0, confirmed: 0, explained: 0, dismissed: 0 };
  for (const r of result.rowRisks) counts[review(r.key).status]++;
  const enabled = (Object.keys(result.config.modules) as (keyof typeof result.config.modules)[])
    .filter((m) => result.config.modules[m])
    .map((m) => (m === 'benford' ? "Benford's Law" : DETECTOR_META[m].label));

  // 1. Summary
  addSheet(
    book,
    used,
    'Summary',
    [
      ['FinPulse audit export', ''],
      ['File', wb.fileName],
      ['Generated', new Date(result.generatedAt)],
      ['Rows scanned', s.totalRows],
      ['Rows flagged', s.flaggedRows],
      ['Critical', s.bySeverity.critical],
      ['High', s.bySeverity.high],
      ['Medium', s.bySeverity.medium],
      ['Low', s.bySeverity.low],
      ['', ''],
      ['Review status', ''],
      [REVIEW_LABEL.confirmed, counts.confirmed],
      [REVIEW_LABEL.explained, counts.explained],
      [REVIEW_LABEL.dismissed, counts.dismissed],
      [REVIEW_LABEL.open, counts.open],
      ['', ''],
      ['Settings', ''],
      ['Minimum risk score shown', result.config.minRiskScore],
      ['Z-score limit', result.config.zThreshold],
      ['Robust MAD limit', result.config.modZThreshold],
      ['IQR fence width', result.config.iqrMultiplier],
      ['Isolation Forest cut-off', result.config.iforest.threshold],
      ['Isolation Forest seed', result.config.iforest.seed],
      ['Models enabled', `${enabled.length}: ${enabled.join(', ')}`],
      ['', ''],
      ['Privacy', 'Generated in the browser. The workbook was never uploaded.'],
    ],
    { widths: [28, 70] },
  );

  // 2. Patterns
  if (result.patterns.length) {
    addSheet(
      book,
      used,
      'Patterns',
      [['Sheet', 'Pattern', 'Rows', 'Explanation', 'Search term in FinPulse'], ...result.patterns.map((p) => [p.sheet, p.title, p.rowCount, p.detail, p.filter])],
      { filter: true, widths: [16, 48, 8, 90, 24] },
    );
  }

  // 3. Flagged rows, one sheet per source sheet (each has its own columns)
  const bySheet = new Map<string, RowRisk[]>();
  for (const r of result.rowRisks) {
    const list = bySheet.get(r.sheet);
    if (list) list.push(r);
    else bySheet.set(r.sheet, [r]);
  }
  const multi = wb.sheets.length > 1;
  for (const sheet of wb.sheets) {
    const rows = bySheet.get(sheet.name);
    if (!rows?.length) continue;
    const dates = dateColumns(sheet);
    const table: Table = [
      ['Risk score', 'Severity', 'Excel row', 'Review status', 'Reviewer note', 'Main reason', `Models (of ${DETECTOR_COUNT})`, ...sheet.headers],
    ];
    for (const r of rows) {
      const rv = review(r.key);
      table.push([
        r.riskScore,
        SEVERITY_TEXT[r.severity],
        r.excelRow,
        REVIEW_LABEL[rv.status],
        rv.note || null,
        r.findings[0]?.reason ?? '',
        r.detectors.map((d) => DETECTOR_META[d].label).join(', '),
        ...r.values.map((v, i) => restoreCell(v, dates.has(i))),
      ]);
    }
    addSheet(book, used, multi ? `Flagged - ${sheet.name}` : 'Flagged rows', table, { filter: true });
  }

  // 4. Every individual finding
  const findings: Table = [['Sheet', 'Excel row', 'Row risk', 'Model', 'Column', 'Related column', 'Value', 'Expected low', 'Expected high', 'Signal strength', 'Reason']];
  for (const r of result.rowRisks) {
    for (const f of r.findings) {
      findings.push([
        f.sheet,
        f.excelRow,
        r.riskScore,
        DETECTOR_META[f.detector].label,
        f.column,
        f.relatedColumn ?? null,
        f.value,
        Number.isFinite(f.expected?.low) ? (f.expected!.low as number) : null,
        Number.isFinite(f.expected?.high) ? (f.expected!.high as number) : null,
        Math.round(f.score * 100) / 100,
        f.reason,
      ]);
    }
  }
  addSheet(book, used, 'All findings', findings, { filter: true });

  // 5. Original data with risk columns appended, for sorting/filtering in Excel
  const riskByKey = new Map<string, RowRisk>();
  for (const r of result.rowRisks) riskByKey.set(r.key, r);
  for (const sheet of wb.sheets) {
    const dates = dateColumns(sheet);
    const table: Table = [[...sheet.headers, 'FinPulse risk', 'FinPulse severity', 'FinPulse reason']];
    for (let i = 0; i < sheet.rowCount; i++) {
      const r = riskByKey.get(`${sheet.name}\u0000${i}`);
      table.push([
        ...sheet.rows[i].map((v, c) => restoreCell(v, dates.has(c))),
        r ? r.riskScore : null,
        r ? SEVERITY_TEXT[r.severity] : null,
        r ? r.findings[0]?.reason ?? null : null,
      ]);
    }
    addSheet(book, used, `${sheet.name} + risk`, table, { filter: true });
  }

  book.Props = { Title: `FinPulse audit export: ${wb.fileName}`, Author: 'FinPulse Analytics', CreatedDate: new Date() };
  const buffer = XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
  const stem = wb.fileName.replace(/\.[^.]+$/, '');
  return { buffer, fileName: `${stem} - FinPulse audit.xlsx` };
}
