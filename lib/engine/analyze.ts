import { benfordAnalysis } from './detectors/benford';
import { correlationMatrix, detectCorrelation } from './detectors/correlation';
import { detectDuplicates } from './detectors/duplicate';
import { detectIsolationForest } from './detectors/isolationForest';
import { detectSeasonal } from './detectors/seasonal';
import { detectThresholdClustering } from './detectors/threshold';
import { analyzableColumns, type Detector } from './detectors/shared';
import { detectIQR, detectModifiedZ, detectZScore } from './detectors/univariate';
import { scoreRows, type ColumnGroups } from './ensemble';
import { finite, mean, quantileSorted, sortedCopy, std } from './stats';
import { DETECTOR_META } from './types';
import type {
  AnalysisConfig,
  AnalysisResult,
  BenfordResult,
  ChartSeries,
  ColumnStats,
  CorrelationMatrix,
  DetectorId,
  Finding,
  ParsedSheet,
  Pattern,
  ParsedWorkbook,
  RowRisk,
  Severity,
  SeriesPoint,
  SkippedModule,
} from './types';

/**
 * Detector registry. Adding a model = one file + one line here.
 * Order matters only for progress reporting (slowest last).
 */
const DETECTORS: Record<DetectorId, Detector> = {
  zscore: detectZScore,
  modz: detectModifiedZ,
  iqr: detectIQR,
  seasonal: detectSeasonal,
  correlation: detectCorrelation,
  duplicate: detectDuplicates,
  threshold: detectThresholdClustering,
  iforest: detectIsolationForest,
};
const ORDER = Object.keys(DETECTORS) as DetectorId[];

const MAX_SERIES_PER_SHEET = 12;
const MAX_POINTS = 1_500;

export type ProgressFn = (label: string, pct: number) => void;

export function analyzeWorkbook(wb: ParsedWorkbook, cfg: AnalysisConfig, onProgress?: ProgressFn): AnalysisResult {
  const sheets = wb.sheets.filter((s) => cfg.sheets.length === 0 || cfg.sheets.indexOf(s.name) !== -1);
  const enabled = ORDER.filter((id) => cfg.modules[id]);
  const totalSteps = Math.max(1, sheets.length * (enabled.length + (cfg.modules.benford ? 1 : 0)));
  let step = 0;
  const tick = (label: string) => onProgress?.(label, Math.round((++step / totalSteps) * 100));

  const findings: Finding[] = [];
  const skipped: SkippedModule[] = [];
  const correlations: CorrelationMatrix[] = [];
  const benford: BenfordResult[] = [];
  const patterns: Pattern[] = [];
  const timings: Record<string, number> = { parse: wb.parseMs };

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    for (let e = 0; e < enabled.length; e++) {
      const id = enabled[e];
      const t0 = performance.now();
      const out = DETECTORS[id](sheet, cfg);
      timings[id] = (timings[id] ?? 0) + performance.now() - t0;
      // Loop instead of push(...spread): spreading 100k+ items overflows the call stack.
      for (let i = 0; i < out.findings.length; i++) findings.push(out.findings[i]);
      if (out.skipped) skipped.push({ module: id, sheet: sheet.name, reason: out.skipped });
      if (out.matrix) correlations.push(out.matrix);
      if (out.patterns) for (let i = 0; i < out.patterns.length; i++) patterns.push(out.patterns[i]);
      tick(`${DETECTOR_META[id].label} on ${sheet.name}`);
    }
    if (cfg.modules.benford) {
      const t0 = performance.now();
      const b = benfordAnalysis(sheet, cfg);
      timings.benford = (timings.benford ?? 0) + performance.now() - t0;
      for (let i = 0; i < b.results.length; i++) benford.push(b.results[i]);
      for (let i = 0; i < b.skipped.length; i++) skipped.push({ module: 'benford', sheet: sheet.name, reason: b.skipped[i] });
      tick(`Benford's Law on ${sheet.name}`);
    }
  }

  const t0 = performance.now();
  const sheetMap = new Map<string, ParsedSheet>();
  for (let i = 0; i < sheets.length; i++) sheetMap.set(sheets[i].name, sheets[i]);
  const scored = scoreRows(findings, sheetMap, cfg, groupColumns(sheets, correlations, cfg));
  timings.ensemble = performance.now() - t0;

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (let i = 0; i < scored.rows.length; i++) bySeverity[scored.rows[i].severity]++;
  const byDetector = {} as Record<DetectorId, number>;
  for (let i = 0; i < ORDER.length; i++) byDetector[ORDER[i]] = 0;
  for (let i = 0; i < findings.length; i++) byDetector[findings[i].detector]++;

  let totalRows = 0;
  let analyzedColumns = 0;
  for (let i = 0; i < sheets.length; i++) {
    totalRows += sheets[i].rowCount;
    analyzedColumns += Math.min(cfg.maxColumns, sheets[i].columns.filter((c) => c.analyzable).length);
  }

  const rounded: Record<string, number> = {};
  Object.keys(timings).forEach((k) => {
    rounded[k] = Math.round(timings[k]);
  });

  return {
    workbook: {
      fileName: wb.fileName,
      sizeBytes: wb.sizeBytes,
      parseMs: Math.round(wb.parseMs),
      sheets: wb.sheets.map((s) => ({
        name: s.name,
        rowCount: s.rowCount,
        truncated: s.truncated,
        headers: s.headers,
        dateColumn: s.dateColumn,
        columns: s.columns,
      })),
    },
    config: cfg,
    summary: {
      totalRows,
      analyzedColumns,
      flaggedRows: scored.total,
      flaggedRowsCapped: scored.total > scored.rows.length,
      bySeverity,
      byDetector,
      skipped,
    },
    rowRisks: scored.rows,
    columnStats: buildColumnStats(sheets, scored.rows, cfg),
    benford,
    correlations,
    patterns,
    series: buildSeries(sheets, scored.rows, cfg),
    timings: rounded,
    generatedAt: new Date().toISOString(),
  };
}

const LOCKSTEP_R = 0.9;

/** Union-find over |r| ≥ 0.9 so derived columns (Net, VAT, Total) count as one signal. */
function groupColumns(sheets: ParsedSheet[], computed: CorrelationMatrix[], cfg: AnalysisConfig): ColumnGroups {
  const out: ColumnGroups = new Map();
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const m = computed.find((c) => c.sheet === sheet.name) ?? correlationMatrix(sheet, cfg.correlation.maxColumns);
    const parent = m.columns.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let a = 0; a < m.columns.length; a++) {
      for (let b = a + 1; b < m.columns.length; b++) {
        if (Math.abs(m.r[a][b]) >= LOCKSTEP_R) parent[find(b)] = find(a);
      }
    }
    const groups = new Map<string, string>();
    for (let i = 0; i < m.columns.length; i++) groups.set(m.columns[i], m.columns[find(i)]);
    out.set(sheet.name, groups);
  }
  return out;
}

function buildColumnStats(sheets: ParsedSheet[], rows: RowRisk[], cfg: AnalysisConfig): ColumnStats[] {
  const flagged = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const seen: string[] = [];
    for (let j = 0; j < rows[i].findings.length; j++) {
      const col = rows[i].findings[j].column;
      if (!col || seen.indexOf(col) !== -1) continue;
      seen.push(col);
      const key = `${rows[i].sheet}\u0000${col}`;
      flagged.set(key, (flagged.get(key) ?? 0) + 1);
    }
  }

  const out: ColumnStats[] = [];
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const cols = analyzableColumns(sheet, cfg.maxColumns);
    for (let c = 0; c < cols.length; c++) {
      const raw = sheet.numeric[cols[c].name];
      const v = finite(raw);
      const sorted = sortedCopy(v);
      const m = mean(v);
      out.push({
        sheet: sheet.name,
        column: cols[c].name,
        n: v.length,
        missing: raw.length - v.length,
        mean: m,
        median: quantileSorted(sorted, 0.5),
        std: std(v, m),
        min: sorted[0] ?? NaN,
        max: sorted[sorted.length - 1] ?? NaN,
        q1: quantileSorted(sorted, 0.25),
        q3: quantileSorted(sorted, 0.75),
        flaggedRows: flagged.get(`${sheet.name}\u0000${cols[c].name}`) ?? 0,
      });
    }
  }
  return out;
}

/** Down-sampled chart data: every flagged row is kept, normal rows are strided. */
function buildSeries(sheets: ParsedSheet[], rows: RowRisk[], cfg: AnalysisConfig): ChartSeries[] {
  const out: ChartSeries[] = [];
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const risk = new Map<number, number>();
    for (let i = 0; i < rows.length; i++) if (rows[i].sheet === sheet.name) risk.set(rows[i].row, rows[i].riskScore);

    const useDates = !!sheet.dates;
    const cols = analyzableColumns(sheet, Math.min(cfg.maxColumns, MAX_SERIES_PER_SHEET));
    for (let c = 0; c < cols.length; c++) {
      const raw = sheet.numeric[cols[c].name];
      let available = 0;
      for (let i = 0; i < raw.length; i++) if (Number.isFinite(raw[i])) available++;
      const stride = Math.max(1, Math.ceil(available / MAX_POINTS));
      const points: SeriesPoint[] = [];
      let k = 0;
      for (let i = 0; i < raw.length; i++) {
        const y = raw[i];
        if (!Number.isFinite(y)) continue;
        const r = risk.get(i) ?? 0;
        const x = useDates ? sheet.dates![i] : i;
        if ((k++ % stride === 0 || r > 0) && Number.isFinite(x)) {
          points.push({ x, y, row: i, excelRow: sheet.excelRows[i], risk: r });
        }
      }
      if (useDates) points.sort((a, b) => a.x - b.x);
      out.push({ sheet: sheet.name, column: cols[c].name, xKind: useDates ? 'date' : 'index', points });
    }
  }
  return out;
}
