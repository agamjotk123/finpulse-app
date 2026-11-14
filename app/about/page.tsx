import type { Metadata } from 'next';
import Link from 'next/link';
import { SubPageShell } from '@/components/SubPageShell';
import { SITE, contactHref } from '@/lib/site';

export const metadata: Metadata = {
  title: `About us | ${SITE.name}`,
  description: `Meet the person behind ${SITE.name}.`,
};

export default function AboutPage() {
  const contact = contactHref();

  return (
    <SubPageShell>
      <main className="mx-auto mt-20 max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-pulse">About us</p>
        <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tight [font-stretch:112%] md:text-7xl">
          Hi, I&apos;m Agamjot.
        </h1>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-paper/65">
          <p>
            I&apos;m 17 and I&apos;m passionate about finance. I love the way numbers tell a story, and how one
            number that doesn&apos;t fit can change the whole picture.
          </p>
          <p>
            That idea is why I built {SITE.name}. It scans financial spreadsheets for errors, duplicates and fraud
            patterns, and explains every flag in plain English, so you don&apos;t need to be an auditor to spot
            what looks wrong.
          </p>
          <p>
            Privacy matters to me too. Your files are analysed right in your browser and are never uploaded.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ['Curious', 'Always asking why a number looks the way it does.'],
            ['Plain English', 'Every flag comes with a reason you can actually read.'],
            ['Private', 'Your data stays on your device.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-graphite/60 p-5">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-haze">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/feedback"
            className="rounded-full bg-pulse px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
          >
            Share your feedback
          </Link>
          {contact && (
            <a
              href={contact}
              target={contact.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="rounded-full border border-graphite px-5 py-2.5 text-sm text-paper hover:border-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
            >
              Get in touch
            </a>
          )}
        </div>
      </main>
    </SubPageShell>
  );
}
