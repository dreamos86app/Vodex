import { cn } from "@/lib/utils";

type BirdProps = { className?: string };

/** Stylized crystal bird — compact, visible in light and dark footers. */
export function IcyBirdSvgA({ className }: BirdProps) {
  return (
    <svg
      viewBox="0 0 88 44"
      className={cn("vodex-icy-bird-svg", className)}
      aria-hidden
      data-testid="icy-bird-svg-a"
    >
      <defs>
        <linearGradient id="icyBirdFillA" x1="0%" y1="30%" x2="100%" y2="70%">
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="45%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="icyBirdWingA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.5" />
        </linearGradient>
        <filter id="icyBirdGlowA" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#icyBirdGlowA)">
        <path
          d="M6 26c8-10 18-14 30-12l14-8 10 2-6 8-12 4-8 10-18 6-10-10z"
          fill="url(#icyBirdFillA)"
          stroke="#e0f2fe"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        <path
          d="M28 14l16 6 12-2M34 20l10 8"
          fill="none"
          stroke="url(#icyBirdWingA)"
          strokeWidth="1.2"
          strokeLinecap="round"
          className="vodex-icy-bird-wing"
        />
        <circle cx="52" cy="12" r="2.2" fill="#ffffff" opacity="0.95" />
        <path d="M54 11l5 2-2 1z" fill="#0ea5e9" opacity="0.9" />
      </g>
    </svg>
  );
}

export function IcyBirdSvgB({ className }: BirdProps) {
  return (
    <svg
      viewBox="0 0 88 44"
      className={cn("vodex-icy-bird-svg vodex-icy-bird-svg--mirrored", className)}
      aria-hidden
      data-testid="icy-bird-svg-b"
    >
      <defs>
        <linearGradient id="icyBirdFillB" x1="100%" y1="30%" x2="0%" y2="70%">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="50%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
        </linearGradient>
        <filter id="icyBirdGlowB" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#icyBirdGlowB)">
        <path
          d="M82 24c-8-9-17-13-28-11l-13-7-9 2 5 7 11 3 7 9 17 5 9-8z"
          fill="url(#icyBirdFillB)"
          stroke="#dbeafe"
          strokeWidth="0.85"
          strokeLinejoin="round"
        />
        <path
          d="M60 15l-14 5-11-2M54 21l-9 7"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.85"
          className="vodex-icy-bird-wing"
        />
        <circle cx="38" cy="13" r="2" fill="#ffffff" />
      </g>
    </svg>
  );
}
