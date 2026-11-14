'use client';

import type { useAnalysisEngine } from '@/hooks/useAnalysisEngine';

type Engine = ReturnType<typeof useAnalysisEngine>;

type Props = {
  result: NonNullable<Engine['result']>;
  config: Engine['config'];
  updating: boolean;
  onConfigChange: Engine['updateConfig'];
  onReset: Engine['reset'];
  onExportExcel: Engine['exportExcel'];
};

type Row = Record<string, unknown>;

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function pretty(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
}

export function Dashboard({ result, updating, onReset, onExportExcel }: Props) {
  const data = result as unknown as Record<string, unknown>;
  const entries = Object.entries(data);

  const stats = entries.filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  const lists = entries.filter(([, v]) => Array.isArray(v)) as [string, unknown[]][];

  const tableList = lists.find(
    ([, arr]) => arr.length > 0 && arr[0] !== null && typeof arr[0] === 'object' && !Array.isArray(arr[0]),
  );
  const rows = tableList ? (tableList[1] as Row[]).slice(0, 50) : [];
  const columns = rows.length
    ? Object.keys(rows[0])
        .filter((k) => isPrimitive(rows[0][k]))
        .slice(0, 6)
    : [];

  return (
    <section aria-busy={updating}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-semibold tracking-tight [font-stretch:110%]">Results</h2>
        {updating && <span className="text-sm text-haze">Updating…</span>}
        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={() => (onExportExcel as () => unknown)()}
            className="rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
          >
            Export to Excel
          </button>
          <button
            type="button"
            onClick={() => (onReset as () => unknown)()}
            className="rounded-full border border-graphite px-5 py-2.5 text-sm text-paper hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
          >
            Scan another file
          </button>
        </div>
      </div>

      {(stats.length > 0 || lists.length > 0) && (
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.slice(0, 8).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-graphite/60 p-5">
              <dt className="text-sm text-haze">{pretty(k)}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">{String(v)}</dd>
            </div>
          ))}
          {lists.slice(0, 4).map(([k, arr]) => (
            <div key={k} className="rounded-xl border border-graphite/60 p-5">
              <dt className="text-sm text-haze">{pretty(k)}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">{arr.length}</dd>
            </div>
          ))}
        </dl>
      )}

      {tableList && columns.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-semibold tracking-tight">{pretty(tableList[0])}</h3>
          <div className="mt-4 overflow-x-auto rounded-xl border border-graphite/60">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-graphite/60 text-haze">
                <tr>
                  {columns.map((c) => (
                    <th key={c} scope="col" className="px-4 py-3 font-medium">
                      {pretty(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-graphite/30 last:border-0">
                    {columns.map((c) => (
                      <td key={c} className="px-4 py-3 text-paper/80">
                        {String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tableList[1].length > rows.length && (
            <p className="mt-3 text-sm text-haze">Showing the first {rows.length}. Export to Excel for everything.</p>
          )}
        </div>
      )}
    </section>
  );
}
