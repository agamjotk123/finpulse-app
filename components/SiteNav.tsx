'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/feedback', label: 'Feedback' },
];

/** Top navigation shared by every page. Highlights the page you're on. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm sm:gap-2">
      {LINKS.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse sm:px-4 ${
              active ? 'bg-pulse/15 text-white ring-1 ring-pulse/40' : 'text-haze hover:bg-white/5 hover:text-paper'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
