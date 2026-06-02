"use client";

import * as React from "react";
import Image from "next/image";

/** Full-resolution local PNG — skip optimizer downscaling for cinematic intro. */
export function IntroReferenceImage({
  src,
  alt,
  layout,
  panelId,
}: {
  src: string;
  alt: string;
  layout: "desktop" | "mobile";
  panelId: string;
}) {
  const [ready, setReady] = React.useState(false);

  const pixelSize = layout === "mobile" ? 360 : 960;

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        priority
        unoptimized
        quality={100}
        sizes={`${pixelSize}px`}
        onLoad={() => setReady(true)}
        className={`object-cover object-top brightness-[1.02] contrast-[1.03] transition-opacity duration-150 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        data-intro-reference-image={panelId}
      />
      {!ready ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800/80 to-slate-900/90"
          aria-hidden
        />
      ) : null}
    </>
  );
}
