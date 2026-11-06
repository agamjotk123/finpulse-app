'use client';

import type { EngineProgress } from '@/hooks/useAnalysisEngine';

const STAGE_TEXT: Record<EngineProgress['stage'], string> = {
  reading: 'Opening the file',
  parsing: 'Reading sheets and profiling columns',
  analyzing: 'Running detection models',
  scoring: 'Scoring risk per row',
};

export function AnalysisProgress({ progress, fileName }: { progress: EngineProgress | null; fileName?: string }) {
  const pct = progress?.stage === 'analyzing' || progress?.stage === 'scoring' ? progress.pct : null;
  return (
    <div className="rounded-[28px] border border-graphite/70 bg-white/[0.02] p-8" role="status" aria-live="polite">
      <p className="text-lg font-semibold text-white">{progress ? STAGE_TEXT[progress.stage] : 'Working'}</p>
      <p className="mt-1 text-sm text-white/55">{progress?.label ?? fileName}</p>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={[
            'h-full rounded-full bg-pulse transition-[width] duration-300',
            pct === null ? 'w-1/3 animate-pulse motion-reduce:animate-none' : '',
          ].join(' ')}
          style={pct === null ? undefined : { width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}
