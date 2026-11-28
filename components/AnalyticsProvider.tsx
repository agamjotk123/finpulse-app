'use client';

// ANALYTICS: loads Vercel Analytics (visitor counts) and starts PostHog (action counts).
// Never sends spreadsheet contents. Rules are in lib/analytics.ts.

import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { initAnalytics } from '@/lib/analytics';

/** Vercel Analytics counts visitors (cookie-free); PostHog counts actions when a key is set. */
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return <Analytics />;
}
