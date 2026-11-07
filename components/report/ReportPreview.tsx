'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AnalysisResult } from '@/lib/engine/types';
import type { Reviews } from '@/lib/ui/review';
import { AuditReport } from './AuditReport';
import { track } from '@/lib/analytics';

const PREPARER_KEY = 'finpulse:prepared-by';

interface Props {
  result: AnalysisResult;
  reviews: Reviews;
  onClose: () => void;
}

/**
 * Shows the report as an A4 page and saves it via the browser's PDF engine: real text,
 * sharp vector charts, proper page breaks, and nothing sent to a server.
 */
export function ReportPreview({ result, reviews, onClose }: Props) {
  const [preparedBy, setPreparedBy] = useState('');

  useEffect(() => {
    try {
      setPreparedBy(window.localStorage.getItem(PREPARER_KEY) ?? '');
    } catch {
      /* storage unavailable */
    }
    document.body.classList.add('fp-report-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('fp-report-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const savePdf = () => {
    try {
      window.localStorage.setItem(PREPARER_KEY, preparedBy);
    } catch {
      /* storage unavailable */
    }
    // Chrome and Safari use the page title as the suggested PDF file name.
    const previous = document.title;
    const stem = result.workbook.fileName.replace(/\.[^.]+$/, '');
    document.title = `${stem} - FinPulse audit report`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    track('pdf_saved');
    window.print();
  };

  return createPortal(
    <div id="fp-report-root" className="fp-report-scroll fixed inset-0 z-50 overflow-y-auto bg-[#1C1D22]" role="dialog" aria-modal="true" aria-label="Audit report preview">
      <div className="fp-no-print sticky top-0 z-10 border-b border-graphite bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 text-sm text-haze">
            Prepared by
            <input
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Your name and company"
              className="min-w-0 flex-1 rounded-lg border border-graphite bg-transparent px-3 py-2 text-sm text-paper placeholder:text-haze/70 focus:border-pulse focus:outline-none"
            />
          </label>
          <button
            onClick={savePdf}
            className="rounded-full bg-paper px-5 py-2 text-sm font-semibold text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Save as PDF
          </button>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-paper hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
            Close
          </button>
        </div>
        <p className="mx-auto max-w-[210mm] px-4 pb-3 text-xs text-haze">
          In the print window, set Destination to <span className="text-paper">Save as PDF</span>, then click Save.
        </p>
      </div>
      <div className="fp-paper mx-auto my-8 w-full max-w-[210mm] bg-white px-[14mm] py-[16mm] shadow-2xl">
        <AuditReport result={result} reviews={reviews} preparedBy={preparedBy.trim()} />
      </div>
    </div>,
    document.body,
  );
}
