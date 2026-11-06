import type { AnalysisConfig, ColumnProfile, CorrelationMatrix, DetectorId, Finding, ParsedSheet, Pattern } from '../types';

export interface DetectorOutput {
  findings: Finding[];
  /** Why the detector could not run on this sheet (shown in the UI, never silent). */
  skipped?: string;
  matrix?: CorrelationMatrix;
  patterns?: Pattern[];
}

export type Detector = (sheet: ParsedSheet, cfg: AnalysisConfig) => DetectorOutput;

export function analyzableColumns(sheet: ParsedSheet, max = Infinity): ColumnProfile[] {
  return sheet.columns.filter((c) => c.analyzable).slice(0, max);
}

type FindingInput = Omit<Finding, 'id' | 'sheet' | 'row' | 'excelRow' | 'detector'>;

export function makeFinding(sheet: ParsedSheet, row: number, detector: DetectorId, f: FindingInput): Finding {
  return {
    id: `${detector}:${sheet.name}:${row}:${f.column ?? '*'}:${f.relatedColumn ?? ''}`,
    sheet: sheet.name,
    row,
    excelRow: sheet.excelRows[row] || row + sheet.headerRowIndex + 2,
    detector,
    ...f,
  };
}
