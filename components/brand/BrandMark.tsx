/** Vector FinPulse mark (ring, pulse line, bolt). Crisp at 16px favicons and 512px PWA icons alike. */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="FinPulse">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#4A4A4A" strokeWidth="5" />
      <polyline
        points="20,52 35,52 45,31 56,62 64,40 70,52 82,52"
        fill="none"
        stroke="#1A3CFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="62,14 44,52 56,52 42,88 66,46 54,46" fill="#FF2323" />
    </svg>
  );
}
