'use client';

import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ACCEPTED_EXTENSIONS } from '@/hooks/useAnalysisEngine';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
  maxMb?: number;
}

export function FileDropzone({ onFile, disabled, maxMb = 50 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (f && !disabled) onFile(f);
    },
    [disabled, onFile],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Choose a workbook to scan"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={onKey}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        'group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[28px] border px-8 py-14 text-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse focus-visible:ring-offset-4 focus-visible:ring-offset-ink',
        dragging ? 'border-pulse bg-pulse/10' : 'border-graphite/70 bg-white/[0.02] hover:border-white/40',
        disabled ? 'pointer-events-none opacity-50' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="text-2xl font-semibold tracking-tight text-white">
        {dragging ? 'Release to start the scan' : 'Drop a workbook to scan it'}
      </p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
        Excel, CSV or OpenDocument, up to {maxMb} MB. It's analysed on this device and never uploaded.
      </p>
      <span className="mt-8 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink">Choose file</span>
    </div>
  );
}
