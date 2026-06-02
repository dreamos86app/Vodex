"use client";

/** Lightweight SVG crystal birds for premium footer motion. */
export function FooterIcedBirds() {
  return (
    <div className="vodex-footer-birds pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="vodex-footer-bird vodex-footer-bird--a"
        viewBox="0 0 64 32"
        width="56"
        height="28"
        fill="none"
      >
        <path
          d="M4 20 C18 8 28 8 38 14 L52 10 L48 18 C38 22 28 26 14 24 Z"
          fill="url(#birdGradA)"
          opacity="0.55"
        />
        <defs>
          <linearGradient id="birdGradA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        className="vodex-footer-bird vodex-footer-bird--b"
        viewBox="0 0 64 32"
        width="48"
        height="24"
        fill="none"
      >
        <path
          d="M6 18 C20 6 32 10 42 16 L58 12 L54 20 C42 24 28 24 16 22 Z"
          fill="url(#birdGradB)"
          opacity="0.45"
        />
        <defs>
          <linearGradient id="birdGradB" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
