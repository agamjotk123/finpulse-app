'use client';

import { useState } from 'react';

const SAMPLES = [
  {
    file: 'sample-expenses.xlsx',
    title: 'Expense claims',
    blurb: '3,000 claims. One employee keeps splitting claims to stay under an approval limit.',
  },
  {
    file: 'sample-ledger.xlsx',
    title: 'Supplier ledger',
    blurb: '2,400 invoices with a wrong VAT rate, a duplicate payment and an inflated amount.',
  },
];

/** One-click demo data, so visitors from LinkedIn can try FinPulse without their own files. */
export function SampleFiles({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = async (name: string) => {
    setLoading(name);
    setError(false);
    try {
      const res = await fetch(`/samples/${name}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      onFile(new File([blob], name, { type: blob.type }));
    } catch {
      setError(true);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-10">
      <p className="text-sm text-haze">No spreadsheet to hand? Try one of these. They contain made-up data with hidden problems.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SAMPLES.map((s) => (
          <button
            key={s.file}
            onClick={() => load(s.file)}
            disabled={disabled || loading !== null}
            className="rounded-2xl border border-graphite/80 px-5 py-4 text-left transition-colors hover:border-paper/60 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
          >
            <span className="block font-semibold text-paper">{loading === s.file ? 'Opening…' : s.title}</span>
            <span className="mt-1 block text-sm leading-relaxed text-haze">{s.blurb}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-bolt">The sample couldn’t be loaded. Refresh the page and try again.</p>}
    </div>
  );
}
