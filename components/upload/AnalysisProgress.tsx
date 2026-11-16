'use client';

type Props = {
  progress: unknown;
  fileName?: string;
};

function read(progress: unknown): { percent: number | null; label: string | null } {
  if (typeof progress === 'number') {
    return { percent: progress <= 1 ? progress * 100 : progress, label: null };
  }
  if (progress && typeof progress === 'object') {
    const o = progress as Record<string, unknown>;
    let percent: number | null = null;
    for (const k of ['percent', 'pct', 'progress', 'fraction', 'value']) {
      if (typeof o[k] === 'number') {
        const n = o[k] as number;
        percent = n <= 1 ? n * 100 : n;
        break;
      }
    }
    let label: string | null = null;
    for (const k of ['label', 'message', 'stage', 'phase', 'step']) {
      if (typeof o[k] === 'string') {
        label = o[k] as string;
        break;
      }
    }
    return { percent, label };
  }
  return { percent: null, label: null };
}

export function AnalysisProgress({ progress, fileName }: Props) {
  const { percent, label } = read(progress);
  const pct = percent === null ? null : Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-graphite/60 p-8">
      <p className="text-xl font-semibold tracking-tight">Scanning{fileName ? ` ${fileName}` : ''}</p>
      <p className="mt-2 text-sm text-haze">{label ?? 'Checking every row. This stays in your browser.'}</p>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-graphite/60">
        <div
          className={`h-full rounded-full bg-pulse transition-[width] duration-300 ${pct === null ? 'w-1/3 animate-pulse' : ''}`}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      {pct !== null && <p className="mt-2 text-sm text-haze">{pct}%</p>}
    </div>
  );
}
