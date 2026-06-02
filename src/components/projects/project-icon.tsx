"use client";

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
  circular = true,
}: Props) {
  const src = projectIconSrc(projectId, iconSvg, iconUrl, cacheKey);
  const px = `${size}px`;

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
      <img src={src} alt="" className="size-full object-cover" loading="lazy" />
    </div>
  );
}
