import { makeFinding, type Detector } from './shared';
import type { Finding } from '../types';

const SEP = '\u241F';

/**
 * Exact duplicates across every field except identifier columns — the classic
 * "same invoice paid twice under a new voucher number" pattern.
 */
export const detectDuplicates: Detector = (sheet) => {
  const keyCols: number[] = [];
  const measureCols: number[] = [];
  for (let c = 0; c < sheet.columns.length; c++) {
    const col = sheet.columns[c];
    if (col.role === 'identifier' || col.role === 'empty') continue;
    keyCols.push(col.index);
    if (col.analyzable) measureCols.push(col.index);
  }
  if (keyCols.length < 2) return { findings: [], skipped: 'Needs at least 2 non-identifier columns.' };
  if (!measureCols.length) return { findings: [], skipped: 'No numeric measures to compare.' };

  const firstSeen = new Map<string, number>();
  const findings: Finding[] = [];

  for (let i = 0; i < sheet.rowCount; i++) {
    const row = sheet.rows[i];
    // Ignore template/blank-ish rows: require a non-zero amount somewhere.
    let hasAmount = false;
    for (let m = 0; m < measureCols.length; m++) {
      const v = row[measureCols[m]];
      if (v !== null && v !== 0 && v !== '' && v !== '0') {
        hasAmount = true;
        break;
      }
    }
    if (!hasAmount) continue;

    let filled = 0;
    const parts: string[] = new Array(keyCols.length);
    for (let k = 0; k < keyCols.length; k++) {
      const v = row[keyCols[k]];
      if (v !== null && v !== '') filled++;
      parts[k] = v === null ? '' : typeof v === 'string' ? v.trim().toLowerCase() : String(v);
    }
    if (filled < 2) continue;

    const key = parts.join(SEP);
    const first = firstSeen.get(key);
    if (first === undefined) {
      firstSeen.set(key, i);
      continue;
    }
    findings.push(
      makeFinding(sheet, i, 'duplicate', {
        column: null,
        value: null,
        score: 1,
        reason: `Exact duplicate of Excel row ${sheet.excelRows[first]} — every field matches apart from identifiers.`,
      }),
    );
  }
  return { findings };
};
