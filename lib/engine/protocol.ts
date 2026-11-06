import type { ConfigPatch } from './config';
import type { AnalysisConfig, AnalysisResult } from './types';
import type { Reviews } from '@/lib/ui/review';

/** Main thread → worker. */
export type WorkerRequest =
  | { type: 'analyze-file'; id: string; buffer: ArrayBuffer; fileName: string; config: AnalysisConfig }
  | { type: 'reanalyze'; id: string; config: AnalysisConfig }
  | { type: 'export-xlsx'; id: string; reviews: Reviews }
  | { type: 'dispose'; id: string };

export type EngineStage = 'reading' | 'parsing' | 'analyzing' | 'scoring';

/** Worker → main thread. Every message carries the request id so stale replies are ignored. */
export type WorkerResponse =
  | { type: 'progress'; id: string; stage: EngineStage; label: string; pct: number }
  | { type: 'result'; id: string; result: AnalysisResult }
  | { type: 'export-ready'; id: string; buffer: ArrayBuffer; fileName: string }
  | { type: 'error'; id: string; message: string };

export type { ConfigPatch };
