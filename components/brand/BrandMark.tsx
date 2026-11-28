'use client';

import { useId } from 'react';

/**
 * Benfora mark: a compact "B" standing in a skyline of isometric bars, with one red bar
 * rising above the rest. That's the product in one picture: the number that doesn't fit.
 *
 * variant "full" for 48px and up; "mini" (just the B and the red bar) stays crisp at
 * browser-tab sizes; "auto" picks based on size.
 */
type Variant = 'auto' | 'full' | 'mini';

const BLUE = ['#7D93FF', '#2347FF', '#0F25A8'];
const RED = ['#FF8A8A', '#FF2323', '#A80E0E'];
const B_PATH = 'M33 22 V78 M33 22 H53 C67 22 67 48 53 48 H33 M33 48 H57 C73 48 73 78 57 78 H33';

type Pt = [number, number];
const pts = (p: Pt[]) => p.map((q) => q.join(',')).join(' ');

function isoBar(x: number, y: number, w: number, h: number, red: boolean, key: string) {
  const c = red ? RED : BLUE;
  const L: Pt = [x, y];
  const F: Pt = [x + w, y + w / 2];
  const R: Pt = [x + 2 * w, y];
  const Bk: Pt = [x + w, y - w / 2];
  const up = (q: Pt): Pt => [q[0], q[1] - h];
  return (
    <g key={key}>
      <polygon points={pts([L, F, up(F), up(L)])} fill={c[1]} />
      <polygon points={pts([F, R, up(R), up(F)])} fill={c[2]} />
      <polygon points={pts([up(L), up(F), up(R), up(Bk)])} fill={c[0]} />
    </g>
  );
}

export function BrandMark({
  size = 40,
  variant = 'auto',
  tile = true,
  className,
}: {
  size?: number;
  variant?: Variant;
  tile?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const mode = variant === 'auto' ? (size < 48 ? 'mini' : 'full') : variant;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Benfora">
      <defs>
        <radialGradient id={`t${id}`} cx="35%" cy="25%" r="95%">
          <stop offset="0" stopColor="#0E1A66" />
          <stop offset="1" stopColor="#04050A" />
        </radialGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6A84FF" />
          <stop offset=".55" stopColor="#1A3CFF" />
          <stop offset="1" stopColor="#7A3CFF" />
        </linearGradient>
      </defs>
      {tile && <rect width="100" height="100" rx="24" fill={`url(#t${id})`} />}

      {mode === 'full' ? (
        <>
          {[
            [7, 34, false],
            [17.5, 24, false],
            [64, 28, false],
            [74.5, 55, true],
            [85, 20, false],
          ].map(([x, h, red], i) => isoBar(x as number, 78, 4.6, h as number, red as boolean, `b${i}`))}
          <g transform={`translate(16.3 ${80 - 83.5 * 0.56}) scale(0.56)`}>
            <path d={B_PATH} fill="none" stroke={`url(#b${id})`} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </>
      ) : (
        <>
          <g transform="translate(2 4) scale(0.86)">
            <path d={B_PATH} fill="none" stroke={`url(#b${id})`} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {isoBar(74, 80, 6.5, 58, true, 'red')}
        </>
      )}
    </svg>
  );
}
