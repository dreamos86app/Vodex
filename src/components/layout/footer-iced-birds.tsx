"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export const FOOTER_ICY_BIRD_SRC = "/footer/icy-bird-static.png";

const BIRD_WIDTH = 520;
const BIRD_HEIGHT = 316;

function FooterBird({
  mirrored,
  className,
  testId,
}: {
  mirrored?: boolean;
  className?: string;
  testId: string;
}) {
  return (
    <div className={cn("vodex-footer-bird-static", className)} data-testid={testId}>
      <span className="vodex-footer-bird-aura" aria-hidden />
      <Image
        src={FOOTER_ICY_BIRD_SRC}
        alt=""
        width={BIRD_WIDTH}
        height={BIRD_HEIGHT}
        className={cn("vodex-footer-bird-png", mirrored && "vodex-footer-bird-png--mirrored")}
        sizes="(max-width: 1023px) 118px, 168px"
        draggable={false}
        unoptimized
      />
    </div>
  );
}

/** Desktop: two birds toward center. Mobile: one bird on the right, facing inward. */
export function FooterIcedBirds() {
  return (
    <div className="vodex-footer-birds-arena" aria-hidden data-testid="footer-iced-birds">
      <div className="vodex-footer-birds-layer">
        <FooterBird
          testId="footer-iced-bird-a"
          className="vodex-footer-bird-static--left vodex-footer-bird-static--desktop-only"
        />
        <FooterBird
          testId="footer-iced-bird-b"
          mirrored
          className="vodex-footer-bird-static--right vodex-footer-bird-static--desktop-only"
        />
        <FooterBird
          testId="footer-iced-bird-mobile"
          mirrored
          className="vodex-footer-bird-static--mobile-only"
        />
      </div>
    </div>
  );
}
