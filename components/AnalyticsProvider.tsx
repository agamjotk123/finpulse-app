'use client';

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
