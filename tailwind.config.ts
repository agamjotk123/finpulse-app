// DESIGN SETTINGS for Tailwind CSS: brand colours, fonts and shadows used in class names
// like bg-ink, text-pulse, border-graphite.

import type { Config } from 'tailwindcss';

/** Brand tokens taken directly from the Benfora logo. Merge into your existing config. */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#05070D', // page background
        pulse: '#1A3CFF', // the pulse line: primary actions, normal data
        bolt: '#FF2323', // the bolt: risk, anomalies, critical states only
        graphite: '#273046', // borders and quiet structure (slate, blue-tinted)
        surface: '#0B1019', // card background
        paper: '#EDEEF2', // text
        haze: '#8B93A7', // secondary text
        mint: '#2DD4A7', // positive / healthy states
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(51,85,255,0.35), 0 8px 30px -8px rgba(26,60,255,0.55)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
};

export default config;
