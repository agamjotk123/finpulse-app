import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { SITE } from '@/lib/site';

/** Shared frame for the About and Feedback pages, matching the home page's header and footer. */
export function SubPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 md:px-8">
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
            <BrandMark size={38} />
            <span className="text-lg font-semibold tracking-tight [font-stretch:110%]">{SITE.name}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2 text-sm">
            <Link
              href="/about"
              className="rounded-full border border-graphite px-4 py-2 text-paper hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
            >
              About us
            </Link>
            <Link
              href="/feedback"
              className="rounded-full border border-graphite px-4 py-2 text-paper hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
            >
              Feedback
            </Link>
          </nav>
        </header>

        {children}

        <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-graphite/60 pt-6 text-sm text-haze">
          <p className="max-w-xl">Your files are analysed in your browser and never uploaded.</p>
          <p>
            <Link href="/" className="text-paper underline-offset-4 hover:underline">
              Back to {SITE.name}
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
