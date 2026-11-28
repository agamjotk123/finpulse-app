'use client';

// TOP NAVIGATION: Home / About us / Feedback links, shared by every page.
// To add a page link, add an entry to LINKS below.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The links shown in the nav: href = address, label = text
const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/feedback', label: 'Feedback' },
];

/** Top navigation shared by every page. Highlights the page you're on. */
export function SiteNav() {
  const pathname = usePathname();  // the current page's address, e.g. '/about'
  return (
    <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm sm:gap-2">
      {LINKS.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);  // highlight the link for the page you're on
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse sm:px-4 ${
              active ? 'bg-paper/10 text-paper' : 'text-haze hover:text-paper'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
