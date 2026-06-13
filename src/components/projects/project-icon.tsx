"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { projectIconSrc, projectHasGeneratedIcon } from "@/lib/projects/ensure-project-icon";

type Props = {
  projectId: string;
  name?: string;
  iconSvg?: string | null;
  iconUrl?: string | null;
  cacheKey?: string | null;
  size?: number;
  className?: string;
  /** When true, renders a filled circle. Default false — square rounded-xl. */
  circular?: boolean;
  /** When false, hide icon until a real generated/imported asset exists. */
  showPlaceholder?: boolean;
  metadata?: Record<string, unknown> | null;
};

export function ProjectIcon({
  projectId,
  name,
  iconSvg,
  iconUrl,
  cacheKey,
  size = 40,
  className,
  circular = false,
  showPlaceholder = true,
  metadata,
}: Props) {
  const hasReal = showPlaceholder || projectHasGeneratedIcon({ iconUrl, iconSvg, metadata });
  if (!hasReal) return null;

  const primarySrc = projectIconSrc(projectId, iconSvg, iconUrl, cacheKey);
  const fallbackSrc = projectIconSrc(projectId, null, null, cacheKey);
  const [src, setSrc] = React.useState(primarySrc);
  const [imgFailed, setImgFailed] = React.useState(false);
  const px = `${size}px`;
  const initial = (name?.trim().charAt(0) || "A").toUpperCase();

  React.useEffect(() => {
    setSrc(primarySrc);
    setImgFailed(false);
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
      {imgFailed ? (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5 text-[13px] font-bold text-accent">
          {initial}
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => {
            if (src !== fallbackSrc) setSrc(fallbackSrc);
            else setImgFailed(true);
          }}
        />
      )}
    </div>
  );
}
