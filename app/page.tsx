'use client';

// HOME PAGE (benfora.vercel.app)
// Shows one of three screens: 1) upload, 2) scanning progress, 3) the results dashboard.
// All the real work happens in useAnalysisEngine; this file only decides what to show.

import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { SiteNav } from '@/components/SiteNav';
import { InstallApp } from '@/components/InstallApp';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AnalysisProgress } from '@/components/upload/AnalysisProgress';
import { FileDropzone } from '@/components/upload/FileDropzone';
import { SampleFiles } from '@/components/upload/SampleFiles';
import { SITE, contactHref } from '@/lib/site';
import { track } from '@/lib/analytics';
import { useAnalysisEngine } from '@/hooks/useAnalysisEngine';
import { DETECTOR_COUNT } from '@/lib/engine/types';

const MAX_MB = 50;  // biggest file a visitor can upload

export default function HomePage() {
  const engine = useAnalysisEngine({ maxFileBytes: MAX_MB * 1024 * 1024 });  // starts the analysis engine (hooks/useAnalysisEngine.ts)
  const working = engine.status === 'working';  // true while a file is being scanned
  const firstScan = working && !engine.result;  // first scan: show the progress bar
  const showUpload = !engine.result && !working;  // nothing scanned yet: show the upload screen
  const contact = contactHref();  // email/LinkedIn link from lib/site.ts (null if not set)

  return (
    <div className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 md:px-8">
        {/* HEADER: full logo + name (links home), page links, Install app button */}
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
            <BrandMark size={44} variant="full" />
            <span className="text-lg font-semibold tracking-tight [font-stretch:110%]">{SITE.name}</span>
          </Link>
          <SiteNav />
          <InstallApp />
        </header>

        {/* ERROR: e.g. wrong file type or file too large */}
        {engine.error && (
          <div role="alert" className="mt-8 rounded-xl border border-bolt/50 bg-bolt/10 px-5 py-4 text-sm text-paper">
            {engine.error}
          </div>
        )}

        {/* SCREEN 1, UPLOAD: headline, drop zone and sample files */}
        {showUpload && (
          <div className="mx-auto mt-20 max-w-3xl">
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight [font-stretch:112%] md:text-7xl">
              Find the numbers that don&apos;t belong.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/65">
              Every row of your ledger is scored by {DETECTOR_COUNT} detection models, and every flag comes with a plain-language reason.
            </p>
            <div className="mt-12">
              <FileDropzone onFile={(f) => engine.analyzeFile(f, 'upload')} maxMb={MAX_MB} />
            </div>
            <SampleFiles onFile={(f) => engine.analyzeFile(f, 'sample')} />
          </div>
        )}

        {/* SCREEN 2, SCANNING: progress bar while the first file is analysed */}
        {firstScan && (
          <div className="mx-auto mt-20 max-w-3xl">
            <AnalysisProgress progress={engine.progress} fileName={engine.file?.name} />
          </div>
        )}

        {/* SCREEN 3, RESULTS: the full dashboard (components/dashboard/Dashboard.tsx) */}
        {engine.result && (
          <div className="mt-12">
            <Dashboard
              result={engine.result}
              config={engine.config}
              updating={working}
              onConfigChange={engine.updateConfig}
              onReset={engine.reset}
              onExportExcel={engine.exportExcel}
            />
          </div>
        )}
        {/* FOOTER: privacy note, page links and the "Built by" credit */}
        <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-graphite/60 pt-6 text-sm text-haze">
          <p className="max-w-xl">Your files are analysed in your browser and never uploaded. We count anonymous usage, like how many scans are run, but never see your data.</p>
          <p className="flex gap-4">
            <Link href="/about" className="text-paper underline-offset-4 hover:underline">
              About us
            </Link>
            <Link href="/feedback" className="text-paper underline-offset-4 hover:underline">
              Feedback
            </Link>
          </p>
          <p>
            Built by {SITE.ownerName}
            {contact && (
              <>
                {', '}
                <a
                  href={contact}
                  onClick={() => track('contact_clicked', { place: 'footer' })}
                  className="text-paper underline-offset-4 hover:underline"
                  target={contact.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                >
                  get in touch
                </a>
              </>
            )}
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
