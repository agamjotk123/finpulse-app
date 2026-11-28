import type { AnalysisConfig } from './types';

export const DEFAULT_CONFIG: AnalysisConfig = {
  modules: {
    zscore: true,
    modz: true,
    iqr: true,
    iforest: true,
    seasonal: true,
    correlation: true,
    duplicate: true,
    threshold: true,
    benford: true,
  },
  zThreshold: 3,
  modZThreshold: 3.5,
  iqrMultiplier: 1.5,
  // Fixed seed => identical results on every run. Auditors need reproducibility.
  iforest: { trees: 100, sampleSize: 256, threshold: 0.62, seed: 42 },
  correlation: { minAbsR: 0.8, residualThreshold: 3.5, maxColumns: 40 },
  seasonal: { residualThreshold: 3.5 },
  minRiskScore: 35,
  maxRows: 200_000,
  maxColumns: 60,
  maxFlaggedRows: 5_000,
  sheets: [],
};

type Patch<T> = {
  [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? Partial<T[K]> : T[K];
};
export type ConfigPatch = Patch<AnalysisConfig>;

export function mergeConfig(base: AnalysisConfig, patch: ConfigPatch = {}): AnalysisConfig {
  return {
    ...base,
    ...patch,
    modules: { ...base.modules, ...patch.modules },
    iforest: { ...base.iforest, ...patch.iforest },
    correlation: { ...base.correlation, ...patch.correlation },
    seasonal: { ...base.seasonal, ...patch.seasonal },
    sheets: patch.sheets ?? base.sheets,
  };
}
