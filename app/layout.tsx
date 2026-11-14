import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { SITE } from '@/lib/site';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import './globals.css';

// Archivo: a grotesque with a width axis. Headline figures use it slightly expanded.
const archivo = Archivo({ subsets: ['latin'], variable: '--font-sans', axes: ['wdth'], display: 'swap' });


// On Vercel this resolves to your live address, so link previews work on LinkedIn.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${SITE.name}: ${SITE.tagline}`,
  description: SITE.description,
  openGraph: {
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
    type: 'website',
    siteName: SITE.name,
  },
  twitter: { card: 'summary_large_image', title: SITE.name, description: SITE.description },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#04050A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="font-sans">
        {children}
        <AnalyticsProvider />
      </body>
    </html>
  );
}
