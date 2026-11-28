'use client';

import { useRef, useState } from 'react';

type Props = {
  onFile: (file: File) => void;
  maxMb: number;
};

const ACCEPT = '.xlsx,.xls,.csv';

export function FileDropzone({ onFile, maxMb }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handle(file: File | undefined) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError('That file type isn’t supported. Use .xlsx, .xls or .csv.');
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`That file is larger than ${maxMb} MB. Try a smaller export.`);
      return;
    }
    setError(null);
    onFile(file);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a spreadsheet"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`fp-card cursor-pointer rounded-[2.25rem] border-2 border-dashed px-6 py-20 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse ${
          dragging ? 'border-pulse bg-pulse/10 shadow-glow' : 'border-white/15 hover:border-pulse/60 hover:shadow-glow'
        }`}
      >
        <div aria-hidden className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-pulse/30 bg-pulse/10 text-[#8FA3FF]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
        </div>
        <p className="text-xl font-semibold tracking-tight">Drop a spreadsheet here</p>
        <p className="mt-2 text-sm text-haze">
          or click to choose a file. .xlsx, .xls or .csv, up to {maxMb} MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-bolt">
          {error}
        </p>
      )}
    </div>
  );
}
