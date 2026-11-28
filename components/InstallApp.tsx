'use client';

// "INSTALL APP" BUTTON in the header.
// Registers the service worker (public/sw.js) so Benfora works offline, shows the browser's
// install dialog on Chrome/Edge/Android, and Add-to-Home-Screen steps on iPhone.
// Hides itself when the app is already installed or the browser can't install apps.

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Registers the service worker and shows an "Install app" button.
 * Chrome, Edge and Android get the native install dialog; iPhone/iPad users
 * (Safari has no install dialog) get simple Add to Home Screen instructions.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {  // turns on offline support
        /* install support is optional */
      });
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document));  // iPhones/iPads have no install dialog, so we show instructions instead

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      track('app_installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);  // Chrome tells us when the app can be installed
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;  // nothing to show: already installed or not installable

  const click = async () => {
    track('app_install_clicked', { platform: ios ? 'ios' : 'other' });
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setPrompt(null);
    } else {
      setShowHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={click}
        className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        Install app
      </button>
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Install Benfora">
          <div className="w-full max-w-sm rounded-2xl border border-graphite bg-ink p-6">
            <h2 className="text-lg font-semibold text-paper">Install Benfora on your iPhone</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-paper/85">
              <li>
                Tap the <span className="font-semibold text-paper">Share</span> button at the bottom of Safari (the square with an arrow).
              </li>
              <li>
                Scroll down and tap <span className="font-semibold text-paper">Add to Home Screen</span>.
              </li>
              <li>
                Tap <span className="font-semibold text-paper">Add</span>. Benfora appears on your home screen like any other app.
              </li>
            </ol>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full rounded-full bg-paper py-2.5 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
