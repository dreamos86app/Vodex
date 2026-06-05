"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { projectIconSrc } from "@/lib/projects/ensure-project-icon";

type Props = {
  projectId: string;
  name?: string;
  iconSvg?: string | null;
  iconUrl?: string | null;
  cacheKey?: string | null;
  size?: number;
  className?: string;
  /** When true, renders a filled circle (default). */
  circular?: boolean;
};

export function ProjectIcon({
  projectId,
  iconSvg,
  iconUrl,
  cacheKey,
  size = 40,
  className,
  circular = false,
}: Props) {
  const primarySrc = projectIconSrc(projectId, iconSvg, iconUrl, cacheKey);
  const fallbackSrc = projectIconSrc(projectId, null, null, cacheKey);
  const [src, setSrc] = React.useState(primarySrc);
  const px = `${size}px`;

  React.useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-surface ring-1 ring-border/80 shadow-sm",
        circular ? "rounded-full" : "rounded-xl",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        onError={() => {
          if (src !== fallbackSrc) setSrc(fallbackSrc);
        }}
      />
    </div>
  );
}
