// ROOT LAYOUT: the frame every page sits inside (home, About, Feedback...).
// Sets the browser-tab title, the LinkedIn/WhatsApp link preview, app icons, the font,
// and switches on analytics. Next.js REQUIRES this file: deleting it breaks the whole site.

import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { SITE } from '@/lib/site';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import './globals.css';

// Archivo: a grotesque with a width axis. Headline figures use it slightly expanded.
const archivo = Archivo({ subsets: ['latin'], variable: '--font-sans', axes: ['wdth'], display: 'swap' });  // the font used across the site


// On Vercel this resolves to your live address, so link previews work on LinkedIn.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),  // makes link-preview image URLs absolute
  title: `${SITE.name}: ${SITE.tagline}`,  // text in the browser tab
  description: SITE.description,
  openGraph: {
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
    type: 'website',
    siteName: SITE.name,
  },
  appleWebApp: { capable: true, title: 'Benfora', statusBarStyle: 'black-translucent' },  // lets iPhones run it full-screen from the home screen
  twitter: { card: 'summary_large_image', title: SITE.name, description: SITE.description },
  manifest: '/manifest.json',  // app name/icons used when someone installs Benfora
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#04050A',  // colour of the phone's status bar
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="font-sans">
        {children}
        {/* Counts visits and actions anonymously (see lib/analytics.ts) */}
        <AnalyticsProvider />
      </body>
    </html>
  );
}
