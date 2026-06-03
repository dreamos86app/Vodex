"use client";

import { IcyBirdSvgA, IcyBirdSvgB } from "@/components/layout/icy-bird-svg";

/** Two icy birds orbiting the footer on circular paths with short icy trails. */
export function FooterIcedBirds() {
  return (
    <div
      className="vodex-footer-birds-layer pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden
      data-testid="footer-iced-birds"
    >
      <div className="vodex-footer-bird-orbit vodex-footer-bird-orbit--a" data-testid="footer-iced-bird-a">
        <div className="vodex-footer-bird-slot">
          <span className="vodex-footer-bird-trail-streak" aria-hidden />
          <IcyBirdSvgA className="vodex-footer-bird-graphic" />
        </div>
      </div>

      <div className="vodex-footer-bird-orbit vodex-footer-bird-orbit--b" data-testid="footer-iced-bird-b">
        <div className="vodex-footer-bird-slot">
          <span className="vodex-footer-bird-trail-streak vodex-footer-bird-trail-streak--b" aria-hidden />
          <IcyBirdSvgB className="vodex-footer-bird-graphic" />
        </div>
      </div>
    </div>
  );
}
