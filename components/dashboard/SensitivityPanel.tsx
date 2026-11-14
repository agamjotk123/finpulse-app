'use client';

import type { ConfigPatch } from '@/lib/engine/config';
import { DETECTOR_META, type AnalysisConfig, type AnalysisModule, type DetectorId } from '@/lib/engine/types';

interface Props {
  config: AnalysisConfig;
  onChange: (patch: ConfigPatch) => void;
  updating: boolean;
}

type PresetId = 'conservative' | 'balanced' | 'thorough';

/** Plain-language presets. Most users never need the individual thresholds. */
const PRESETS: Record<PresetId, { label: string; hint: string; patch: ConfigPatch }> = {
  conservative: {
    label: 'Strict',
    hint: 'Only clear-cut problems',
    patch: { zThreshold: 3.5, modZThreshold: 4.5, iqrMultiplier: 3, iforest: { threshold: 0.68 }, minRiskScore: 55 },
  },
  balanced: {
    label: 'Balanced',
    hint: 'Recommended',
    patch: { zThreshold: 3, modZThreshold: 3.5, iqrMultiplier: 1.5, iforest: { threshold: 0.62 }, minRiskScore: 35 },
  },
  thorough: {
    label: 'Thorough',
    hint: 'More alerts, for audits',
    patch: { zThreshold: 2.5, modZThreshold: 3, iqrMultiplier: 1.2, iforest: { threshold: 0.58 }, minRiskScore: 25 },
  },
};

function activePreset(c: AnalysisConfig): PresetId | null {
  for (const id of Object.keys(PRESETS) as PresetId[]) {
    const p = PRESETS[id].patch;
    if (
      c.zThreshold === p.zThreshold &&
      c.modZThreshold === p.modZThreshold &&
      c.iqrMultiplier === p.iqrMultiplier &&
      c.iforest.threshold === p.iforest?.threshold &&
      c.minRiskScore === p.minRiskScore
    )
      return id;
  }
  return null;
}

function Slider(props: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = `s-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-paper">{props.label}</label>
        <span className="text-sm tabular-nums text-paper">{props.format ? props.format(props.value) : props.value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
      <p className="mt-0.5 text-xs text-haze">{props.hint}</p>
    </div>
  );
}

export function SensitivityPanel({ config, onChange, updating }: Props) {
  const preset = activePreset(config);
  const modules = [...(Object.keys(DETECTOR_META) as DetectorId[]), 'benford'] as AnalysisModule[];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-paper">Sensitivity</h2>
          <span className="text-xs text-haze" aria-live="polite">{updating ? 'Updating…' : ''}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl border border-graphite p-1" role="radiogroup" aria-label="Sensitivity preset">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={preset === id}
              onClick={() => onChange(PRESETS[id].patch)}
              className={[
                'rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse',
                preset === id ? 'bg-paper font-medium text-ink' : 'text-paper/80 hover:bg-white/[0.06]',
              ].join(' ')}
            >
              {PRESETS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-haze">{preset ? PRESETS[preset].hint : 'Custom settings'}</p>
      </div>

      <Slider
        label="Show rows scoring at least"
        hint="Hides weak signals below this risk score."
        value={config.minRiskScore}
        min={0}
        max={90}
        step={5}
        onChange={(v) => onChange({ minRiskScore: v })}
      />

      <details className="group">
        <summary className="cursor-pointer list-none text-sm text-paper">
          <span className="underline decoration-graphite underline-offset-4 group-open:decoration-paper">Fine-tune each model</span>
        </summary>
        <div className="mt-5 space-y-6">
          <Slider label="Z-score limit" hint="Standard deviations from average. Lower flags more." value={config.zThreshold} min={2} max={5} step={0.25} format={(v) => `${v}σ`} onChange={(v) => onChange({ zThreshold: v })} />
          <Slider label="Robust MAD limit" hint="Like Z-score, but not fooled by a few huge values." value={config.modZThreshold} min={2.5} max={6} step={0.25} onChange={(v) => onChange({ modZThreshold: v })} />
          <Slider label="IQR fence width" hint="1.5 is the textbook setting, 3 catches only extremes." value={config.iqrMultiplier} min={1} max={3} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => onChange({ iqrMultiplier: v })} />
          <Slider label="Isolation Forest cut-off" hint="How isolated a row must be across all columns." value={config.iforest.threshold} min={0.5} max={0.75} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => onChange({ iforest: { threshold: v } })} />
          <Slider label="Relationship strength" hint="Only check pairs of columns at least this related." value={config.correlation.minAbsR} min={0.5} max={0.99} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => onChange({ correlation: { minAbsR: v } })} />
        </div>
      </details>

      <div>
        <h2 className="text-base font-semibold text-paper">Models</h2>
        <ul className="mt-3 space-y-1">
          {modules.map((m) => {
            const label = m === 'benford' ? "Benford's Law" : DETECTOR_META[m].label;
            const description = m === 'benford' ? 'Checks whether amounts have natural leading digits.' : DETECTOR_META[m].description;
            return (
              <li key={m}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={config.modules[m]}
                    onChange={(e) => onChange({ modules: { [m]: e.target.checked } })}
                    className="mt-1 accent-pulse"
                  />
                  <span>
                    <span className="block text-sm text-paper">{label}</span>
                    <span className="block text-xs leading-relaxed text-haze">{description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
