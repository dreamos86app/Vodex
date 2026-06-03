"use client";

import Image from "next/image";

/** Premium static icy bird PNG (transparent, trail baked in). */
export const FOOTER_ICY_BIRD_SRC = "/footer/icy-bird-static.png";

/** Intrinsic dimensions of `public/footer/icy-bird-static.png` (hi-res export). */
const BIRD_WIDTH = 520;
const BIRD_HEIGHT = 316;

/**
 * Two static crystal birds — vertically centered, left/right, facing each other.
 * Asset faces right; right instance is mirrored.
 */
export function FooterIcedBirds() {
  return (
    <div className="vodex-footer-birds-arena" aria-hidden data-testid="footer-iced-birds">
      <div className="vodex-footer-birds-layer">
        <div className="vodex-footer-bird-static vodex-footer-bird-static--left" data-testid="footer-iced-bird-a">
          <Image
            src={FOOTER_ICY_BIRD_SRC}
            alt=""
            width={BIRD_WIDTH}
            height={BIRD_HEIGHT}
            className="vodex-footer-bird-png"
            sizes="(max-width: 640px) 108px, 168px"
            draggable={false}
            unoptimized
          />
        </div>
        <div className="vodex-footer-bird-static vodex-footer-bird-static--right" data-testid="footer-iced-bird-b">
          <Image
            src={FOOTER_ICY_BIRD_SRC}
            alt=""
            width={BIRD_WIDTH}
            height={BIRD_HEIGHT}
            className="vodex-footer-bird-png vodex-footer-bird-png--mirrored"
            sizes="(max-width: 640px) 108px, 168px"
            draggable={false}
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
