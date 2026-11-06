import type { Severity } from '@/lib/engine/types';

/** Red is reserved for risk. Blue (the pulse) means "worth a look", grey means "minor". */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#FF2323',
  high: '#FF7A45',
  medium: '#8FA3FF',
  low: '#6B707C',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

export function colorForRisk(risk: number): string {
  if (risk >= 85) return SEVERITY_COLOR.critical;
  if (risk >= 65) return SEVERITY_COLOR.high;
  if (risk >= 40) return SEVERITY_COLOR.medium;
  return SEVERITY_COLOR.low;
}
