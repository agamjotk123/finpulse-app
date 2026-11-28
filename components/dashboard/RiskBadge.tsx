import type { Severity } from '@/lib/engine/types';
import { SEVERITY_COLOR, SEVERITY_LABEL } from '@/lib/ui/severity';

/** Score plus a bar that fills to the score, coloured by severity. */
export function RiskBadge({ score, severity, size = 'md' }: { score: number; severity: Severity; size?: 'md' | 'lg' }) {
  const color = SEVERITY_COLOR[severity];
  return (
    <span className="inline-flex items-center gap-2" title={`${SEVERITY_LABEL[severity]} risk`}>
      <span
        className={size === 'lg' ? 'text-5xl font-semibold tabular-nums [font-stretch:118%]' : 'w-7 text-right text-base font-semibold tabular-nums'}
        style={{ color }}
      >
        {score}
      </span>
      <span className={size === 'lg' ? 'h-1.5 w-24 rounded-full bg-white/10' : 'h-1 w-10 rounded-full bg-white/10'}>
        <span className="block h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </span>
      <span className="sr-only">{SEVERITY_LABEL[severity]}</span>
    </span>
  );
}
