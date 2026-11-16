type Props = {
  size?: number;
  className?: string;
};

/** Small logo: a rounded square with a pulse line running through it. */
export function BrandMark({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Logo"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="10" className="fill-pulse" />
      <path
        d="M6 21h8l3-9 6 18 3-9h8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
