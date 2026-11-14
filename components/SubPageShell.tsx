import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { SITE } from '@/lib/site';

/**
 * Shared frame for secondary pages (About, Feedback, ...): Benfora header with a link
 * home, an optional title block, the page content, and the standard footer.
 * Accepts the common prop names (title / heading, subtitle / description / intro, eyebrow)
 * so pages written against either style work unchanged.
 */
export interface SubPageShellProps {
  children?: ReactNode;
  title?: ReactNode;
  heading?: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  intro?: ReactNode;
  eyebrow?: ReactNode;
  [key: string]: unknown;
}

export function SubPageShell({ children, title, heading, subtitle, description, intro, eyebrow }: SubPageShellProps) {
  const head = title ?? heading;
  const sub = subtitle ?? description ?? intro;
  return (
    <div className="min-h-screen bg-ink text-paper">
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 md:px-8">
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse">
            <BrandMark size={38} />
            <span className="text-lg font-semibold tracking-tight">{SITE.name}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-5 text-sm text-haze">
            <Link href="/" className="hover:text-paper">Scan a file</Link>
            <Link href="/about" className="hover:text-paper">About</Link>
            <Link href="/feedback" className="hover:text-paper">Feedback</Link>
          </nav>
        </header>

        {(eyebrow || head || sub) && (
          <div className="mt-16">
            {eyebrow && <p className="text-sm font-semibold text-bolt">{eyebrow}</p>}
            {head && <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{head}</h1>}
            {sub && <p className="mt-4 max-w-xl text-lg leading-relaxed text-paper/65">{sub}</p>}
          </div>
        )}

        <main className="mt-12 text-paper/85 [&_a]:text-pulse [&_a]:underline [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-paper [&_p]:mt-4 [&_p]:leading-relaxed">
          {children}
        </main>

        <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-graphite/60 pt-6 text-sm text-haze">
          <p>Your files are analysed in your browser and never uploaded.</p>
          <p>Built by {SITE.ownerName}.</p>
        </footer>
      </div>
    </div>
  );
}

export default SubPageShell;
