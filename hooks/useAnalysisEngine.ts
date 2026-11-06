'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG, mergeConfig, type ConfigPatch } from '@/lib/engine/config';
import type { EngineStage, WorkerRequest, WorkerResponse } from '@/lib/engine/protocol';
import type { AnalysisConfig, AnalysisResult } from '@/lib/engine/types';
import { downloadBlob } from '@/lib/ui/download';
import type { Reviews } from '@/lib/ui/review';

export type EngineStatus = 'idle' | 'working' | 'ready' | 'error';

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xlsm', '.xls', '.csv', '.ods'] as const;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const REANALYZE_DEBOUNCE_MS = 250;

export interface EngineProgress {
  stage: EngineStage;
  label: string;
  pct: number;
}

export interface UseAnalysisEngineOptions {
  maxFileBytes?: number;
  initialConfig?: ConfigPatch;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useAnalysisEngine(options: UseAnalysisEngineOptions = {}) {
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;

  const [status, setStatus] = useState<EngineStatus>('idle');
  const [progress, setProgress] = useState<EngineProgress | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [config, setConfig] = useState<AnalysisConfig>(() => mergeConfig(DEFAULT_CONFIG, options.initialConfig));

  const workerRef = useRef<Worker | null>(null);
  const activeId = useRef<string | null>(null);
  const configRef = useRef(config);
  const hasData = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingExports = useRef(new Map<string, { resolve: () => void; reject: (e: Error) => void }>());

  const send = (w: Worker, msg: WorkerRequest, transfer?: Transferable[]) => w.postMessage(msg, transfer ?? []);

  /** Fresh worker per file: dropping a new file instantly cancels any in-flight analysis. */
  const spawn = useCallback(() => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      // Exports run alongside analysis and resolve their own promises.
      const pending = pendingExports.current.get(msg.id);
      if (pending) {
        pendingExports.current.delete(msg.id);
        if (msg.type === 'export-ready') {
          downloadBlob(new Blob([msg.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), msg.fileName);
          pending.resolve();
        } else if (msg.type === 'error') {
          pending.reject(new Error(msg.message));
        }
        return;
      }
      if (msg.id !== activeId.current) return; // stale reply from a superseded request
      if (msg.type === 'progress') {
        setProgress({ stage: msg.stage, label: msg.label, pct: msg.pct });
      } else if (msg.type === 'result') {
        hasData.current = true;
        setResult(msg.result);
        setStatus('ready');
        setProgress(null);
      } else if (msg.type === 'error') {
        setError(msg.message);
        setStatus('error');
        setProgress(null);
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      setError(e.message || 'The analysis engine stopped unexpectedly. Try the file again.');
      setStatus('error');
      setProgress(null);
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      workerRef.current?.terminate();
    },
    [],
  );

  const analyzeFile = useCallback(
    async (f: File) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
        setError(`${f.name} isn't a supported file. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`);
        setStatus('error');
        return;
      }
      if (f.size > maxFileBytes) {
        setError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB. Your plan allows up to ${(maxFileBytes / 1048576).toFixed(0)} MB.`);
        setStatus('error');
        return;
      }

      const id = newId();
      activeId.current = id;
      hasData.current = false;
      setFile({ name: f.name, size: f.size });
      setResult(null);
      setError(null);
      setStatus('working');
      setProgress({ stage: 'reading', label: `Reading ${f.name}`, pct: 0 });

      const buffer = await f.arrayBuffer();
      if (activeId.current !== id) return; // user picked another file meanwhile
      const worker = spawn();
      // Transfer (not copy) the buffer — zero-copy hand-off, important for 50 MB files.
      send(worker, { type: 'analyze-file', id, buffer, fileName: f.name, config: configRef.current }, [buffer]);
    },
    [maxFileBytes, spawn],
  );

  /** Change thresholds/modules. Re-runs on the cached parse, debounced for slider drags. */
  const updateConfig = useCallback((patch: ConfigPatch) => {
    const next = mergeConfig(configRef.current, patch);
    configRef.current = next;
    setConfig(next);
    if (!hasData.current || !workerRef.current) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;
      const id = newId();
      activeId.current = id;
      setStatus('working');
      send(worker, { type: 'reanalyze', id, config: configRef.current });
    }, REANALYZE_DEBOUNCE_MS);
  }, []);

  /** Builds the Excel audit workbook in the worker and downloads it. */
  const exportExcel = useCallback((reviews: Reviews) => {
    const worker = workerRef.current;
    if (!worker || !hasData.current) return Promise.reject(new Error('Run a scan before exporting.'));
    const id = newId();
    return new Promise<void>((resolve, reject) => {
      pendingExports.current.set(id, { resolve, reject });
      send(worker, { type: 'export-xlsx', id, reviews });
    });
  }, []);

  const reset = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    workerRef.current?.terminate();
    workerRef.current = null;
    activeId.current = null;
    pendingExports.current.forEach((p) => p.reject(new Error('Cancelled.')));
    pendingExports.current.clear();
    hasData.current = false;
    setStatus('idle');
    setProgress(null);
    setResult(null);
    setError(null);
    setFile(null);
  }, []);

  return { status, progress, result, error, file, config, analyzeFile, updateConfig, exportExcel, reset };
}

export type AnalysisEngine = ReturnType<typeof useAnalysisEngine>;
