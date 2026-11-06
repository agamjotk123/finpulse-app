/**
 * FinPulse analysis worker.
 * Parsing and every statistical model run here, off the UI thread and entirely inside
 * the user's browser. The workbook is never uploaded anywhere.
 */
import { analyzeWorkbook } from '@/lib/engine/analyze';
import { buildExcelExport } from '@/lib/engine/export';
import { parseWorkbook } from '@/lib/engine/parse';
import type { WorkerRequest, WorkerResponse } from '@/lib/engine/protocol';
import type { AnalysisResult, ParsedWorkbook } from '@/lib/engine/types';

interface WorkerScope {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (e: MessageEvent<WorkerRequest>) => void): void;
}
const scope = self as unknown as WorkerScope;

/** Parsed workbook kept in worker memory so threshold changes re-run in milliseconds. */
let cache: ParsedWorkbook | null = null;
/** Latest result, so exports match exactly what the user is looking at. */
let lastResult: AnalysisResult | null = null;

function run(id: string, wb: ParsedWorkbook, msg: Extract<WorkerRequest, { config: unknown }>) {
  scope.postMessage({ type: 'progress', id, stage: 'analyzing', label: 'Running detection models', pct: 0 });
  const result = analyzeWorkbook(wb, msg.config, (label, pct) =>
    scope.postMessage({ type: 'progress', id, stage: pct >= 100 ? 'scoring' : 'analyzing', label, pct }),
  );
  lastResult = result;
  scope.postMessage({ type: 'result', id, result });
}

scope.addEventListener('message', (e) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'analyze-file': {
        scope.postMessage({ type: 'progress', id: msg.id, stage: 'parsing', label: `Reading ${msg.fileName}`, pct: 0 });
        cache = parseWorkbook(msg.buffer, msg.fileName, { maxRows: msg.config.maxRows });
        if (!cache.sheets.length) {
          throw new Error('No table found. Make sure a sheet has a header row followed by at least one row of data.');
        }
        run(msg.id, cache, msg);
        break;
      }
      case 'reanalyze': {
        if (!cache) throw new Error('Upload a workbook before changing settings.');
        run(msg.id, cache, msg);
        break;
      }
      case 'export-xlsx': {
        if (!cache || !lastResult) throw new Error('Run a scan before exporting.');
        const { buffer, fileName } = buildExcelExport(cache, lastResult, msg.reviews);
        scope.postMessage({ type: 'export-ready', id: msg.id, buffer, fileName }, [buffer]);
        break;
      }
      case 'dispose':
        cache = null;
        lastResult = null;
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The file could not be analysed.';
    scope.postMessage({ type: 'error', id: msg.id, message });
  }
});

export {};
