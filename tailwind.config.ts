import type { Config } from 'tailwindcss';

/** Brand tokens taken directly from the Benfora logo. Merge into your existing config. */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#04050A', // logo background
        pulse: '#1A3CFF', // the pulse line: primary actions, normal data
        bolt: '#FF2323', // the bolt: risk, anomalies, critical states only
        graphite: '#4A4A4A', // the ring: borders and quiet structure
        paper: '#EDEEF2', // text
        haze: '#8A8F9C', // secondary text
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
