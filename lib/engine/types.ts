/**
 * FinPulse Analytics — core engine types.
 * Shared by the Web Worker, the React hook and (later) the dashboard + export layers.
 */

export type CellValue = string | number | boolean | null;

/** Row-level detectors. Each one produces Findings that feed the risk ensemble. */
export type DetectorId =
  | 'zscore'
  | 'modz'
  | 'iqr'
  | 'iforest'
  | 'seasonal'
  | 'correlation'
  | 'duplicate'
  | 'threshold';

/** Everything the user can switch on/off. Benford is column-level, so it is a module but not a DetectorId. */
export type AnalysisModule = DetectorId | 'benford';

/**
 * Detectors are grouped into families so three univariate tests agreeing on the same
 * number (z-score, MAD, IQR) don't triple-count the same evidence.
 */
export type DetectorFamily = 'univariate' | 'multivariate' | 'contextual' | 'relational' | 'integrity' | 'behavioral';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type ColumnKind = 'numeric' | 'date' | 'text' | 'empty';

/** measure = analysed; identifier/dimension = numeric but meaningless to analyse (IDs, years). */
export type ColumnRole = 'measure' | 'identifier' | 'dimension' | 'date' | 'label' | 'empty';

export interface ColumnProfile {
  name: string;
  index: number;
  kind: ColumnKind;
  role: ColumnRole;
  filled: number;
  uniqueRatio: number;
  analyzable: boolean;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** 0-based index of the header row inside the sheet (supports title rows above the table). */
  headerRowIndex: number;
  rows: CellValue[][];
  /** Real Excel row number for every data row — the audit trail auditors expect. */
  excelRows: Int32Array;
  rowCount: number;
  truncated: boolean;
  columns: ColumnProfile[];
  dateColumn: string | null;
  /** Analysable numeric columns as typed arrays (NaN = missing). */
  numeric: Record<string, Float64Array>;
  /** Epoch ms for the detected date column (NaN = missing). */
  dates: Float64Array | null;
}

export interface ParsedWorkbook {
  fileName: string;
  sizeBytes: number;
  sheets: ParsedSheet[];
  parseMs: number;
}

export interface Finding {
  id: string;
  sheet: string;
  /** 0-based data row index. */
  row: number;
  /** Row number as shown in Excel. */
  excelRow: number;
  /** Null for row-level findings (isolation forest, duplicates). */
  column: string | null;
  relatedColumn?: string;
  value: number | null;
  detector: DetectorId;
  /** Normalised evidence strength, 0..1 (0.5 = just over the threshold). */
  score: number;
  expected?: { low?: number; high?: number; center?: number };
  /** Plain-English explanation shown to the user and in audit reports. */
  reason: string;
}

export interface RowRisk {
  key: string;
  sheet: string;
  row: number;
  excelRow: number;
  /** 0..100 consensus risk. */
  riskScore: number;
  severity: Severity;
  detectors: DetectorId[];
  findings: Finding[];
  values: CellValue[];
}

export interface ColumnStats {
  sheet: string;
  column: string;
  n: number;
  missing: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  flaggedRows: number;
}

export type BenfordConformity = 'close' | 'acceptable' | 'marginal' | 'nonconforming';

export interface BenfordResult {
  sheet: string;
  column: string;
  n: number;
  /** Observed share of leading digits 1..9. */
  observed: number[];
  expected: number[];
  mad: number;
  chiSquare: number;
  conformity: BenfordConformity;
  /** Digit most over-represented vs. Benford's Law. */
  excessDigit: number;
}

export interface CorrelationMatrix {
  sheet: string;
  columns: string[];
  r: number[][];
}

export interface SeriesPoint {
  x: number;
  y: number;
  row: number;
  excelRow: number;
  /** 0 when the row is not flagged. */
  risk: number;
}

export interface ChartSeries {
  sheet: string;
  column: string;
  xKind: 'date' | 'index';
  points: SeriesPoint[];
}

/** A finding about many rows at once (e.g. split payments by one employee). */
export interface Pattern {
  id: string;
  sheet: string;
  detector: DetectorId;
  title: string;
  detail: string;
  rowCount: number;
  /** Excel row numbers of the rows that make up the pattern (for the audit trail). */
  excelRows: number[];
  /** Text that, typed into the review-queue search, shows exactly these rows. */
  filter: string;
}

export interface SkippedModule {
  module: AnalysisModule;
  sheet: string;
  reason: string;
}

export interface AnalysisSummary {
  totalRows: number;
  analyzedColumns: number;
  flaggedRows: number;
  /** True when more rows were flagged than config.maxFlaggedRows. */
  flaggedRowsCapped: boolean;
  bySeverity: Record<Severity, number>;
  byDetector: Record<DetectorId, number>;
  skipped: SkippedModule[];
}

export interface AnalysisConfig {
  modules: Record<AnalysisModule, boolean>;
  zThreshold: number;
  modZThreshold: number;
  iqrMultiplier: number;
  iforest: { trees: number; sampleSize: number; threshold: number; seed: number };
  correlation: { minAbsR: number; residualThreshold: number; maxColumns: number };
  seasonal: { residualThreshold: number };
  /** Rows below this consensus score are not reported. */
  minRiskScore: number;
  /** Tier limit (Step 4 wires this to the user's plan). */
  maxRows: number;
  maxColumns: number;
  maxFlaggedRows: number;
  /** Empty = analyse every sheet. */
  sheets: string[];
}

export interface SheetMeta {
  name: string;
  rowCount: number;
  truncated: boolean;
  headers: string[];
  dateColumn: string | null;
  columns: ColumnProfile[];
}

export interface AnalysisResult {
  workbook: { fileName: string; sizeBytes: number; parseMs: number; sheets: SheetMeta[] };
  config: AnalysisConfig;
  summary: AnalysisSummary;
  rowRisks: RowRisk[];
  columnStats: ColumnStats[];
  benford: BenfordResult[];
  correlations: CorrelationMatrix[];
  patterns: Pattern[];
  series: ChartSeries[];
  timings: Record<string, number>;
  generatedAt: string;
}

export const DETECTOR_META: Record<
  DetectorId,
  { label: string; family: DetectorFamily; weight: number; description: string }
> = {
  zscore: {
    label: 'Z-score',
    family: 'univariate',
    weight: 0.75,
    description: 'Distance from the column mean in standard deviations.',
  },
  modz: {
    label: 'Robust MAD',
    family: 'univariate',
    weight: 0.9,
    description: 'Median-based z-score that a few huge values cannot distort.',
  },
  iqr: {
    label: 'IQR fences',
    family: 'univariate',
    weight: 0.7,
    description: 'Outside Tukey fences built from the middle 50% of values.',
  },
  iforest: {
    label: 'Isolation Forest',
    family: 'multivariate',
    weight: 0.95,
    description: 'Unusual combinations of values across many columns at once.',
  },
  seasonal: {
    label: 'Seasonality',
    family: 'contextual',
    weight: 0.95,
    description: 'Unexpected for its point in time after removing trend and seasonality.',
  },
  correlation: {
    label: 'Relationship break',
    family: 'relational',
    weight: 0.9,
    description: 'Breaks a strong relationship between two columns (e.g. net vs. VAT).',
  },
  duplicate: {
    label: 'Duplicate entry',
    family: 'integrity',
    weight: 0.95,
    description: 'Every field matches another row, apart from identifiers.',
  },
  threshold: {
    label: 'Approval-limit clustering',
    family: 'behavioral',
    weight: 0.85,
    description: 'Too many amounts just under a round limit, a sign of split payments.',
  },
};

export const DETECTOR_COUNT = Object.keys(DETECTOR_META).length;
