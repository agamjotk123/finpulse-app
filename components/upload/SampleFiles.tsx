'use client';

import { useState } from 'react';

type Props = {
  onFile: (file: File) => void;
};

// These files must be in your project's /public folder so the browser can fetch them.
const SAMPLES = [
  { file: 'sample-ledger.xlsx', label: 'Sample ledger', note: 'Four planted problems' },
  { file: 'sample-expenses.xlsx', label: 'Sample expenses', note: 'Split claims under a limit' },
];

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function SampleFiles({ onFile }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(name: string) {
    setLoading(name);
    setError(null);
    try {
      const res = await fetch(`/${name}`);
      if (!res.ok) throw new Error('missing');
      const blob = await res.blob();
      onFile(new File([blob], name, { type: XLSX_TYPE }));
    } catch {
      setError('Couldn’t load that sample. Check the file is in the public folder.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-8">
      <p className="text-sm text-haze">No file handy? Try a sample.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {SAMPLES.map((s) => (
          <button
            key={s.file}
            type="button"
            disabled={loading !== null}
            onClick={() => load(s.file)}
            className="rounded-xl border border-graphite px-4 py-3 text-left hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse disabled:opacity-50"
          >
            <span className="block text-sm font-medium text-paper">
              {loading === s.file ? 'Loading…' : s.label}
            </span>
            <span className="block text-xs text-haze">{s.note}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-bolt">
          {error}
        </p>
      )}
    </div>
  );
}
