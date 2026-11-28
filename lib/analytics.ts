// ANONYMOUS USAGE TRACKING (PostHog). Lists the events we count and the track() helper.
// RULE: only event names and rough sizes are sent, never file names, values or messages.

/**
 * Anonymous product analytics.
 *
 * Privacy rules (Benfora's whole promise is that files never leave the browser):
 *  - Only event names and coarse buckets are sent: never file names, column names,
 *    values, reasons or anything from inside a spreadsheet.
 *  - No cookies: PostHog runs with in-memory persistence, no autocapture and no
 *    session recording (a recording could show spreadsheet data on screen).
 *  - If NEXT_PUBLIC_POSTHOG_KEY is not set, nothing is sent at all.
 */
import posthog from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;  // set in Vercel > Environment Variables
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let ready = false;

export function initAnalytics() {
  if (ready || !KEY || typeof window === 'undefined') return;
  posthog.init(KEY, {
    api_host: HOST,
    persistence: 'memory',  // no cookies
    autocapture: false,
    capture_pageview: false, // page views are counted by Vercel Analytics
    capture_pageleave: false,
    disable_session_recording: true,  // never record screens: they could show financial data
    disable_surveys: true,
    person_profiles: 'identified_only',
  });
  ready = true;
}

type Props = Record<string, string | number | boolean>;

export function track(event: AnalyticsEvent, props?: Props) {
  if (!ready) return;
  try {
    posthog.capture(event, props);
  } catch {
    // Analytics must never break the app.
  }
}

export type AnalyticsEvent =
  | 'scan_completed'
  | 'scan_failed'
  | 'report_opened'
  | 'pdf_saved'
  | 'excel_downloaded'
  | 'row_reviewed'
  | 'sensitivity_changed'
  | 'pattern_opened'
  | 'contact_clicked'
  | 'app_install_clicked'
  | 'app_installed'
  | 'feedback_sent';

/** Coarse size buckets so no exact figures from a user's file are ever sent. */
export function bucket(n: number): string {
  if (n <= 0) return '0';
  if (n < 100) return '1-99';
  if (n < 1_000) return '100-999';
  if (n < 10_000) return '1k-10k';
  if (n < 100_000) return '10k-100k';
  return '100k+';
}
