"use client";

import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  bannerSvg?: string | null;
  previewUrl?: string | null;
  title?: string;
  heightClass?: string;
  className?: string;
  /** Card mode: only show live preview URL; otherwise blank white strip. */
  previewOnly?: boolean;
};

export function ProjectBanner({
  projectId,
  bannerSvg,
  previewUrl,
  title,
  heightClass = "h-20",
  className,
  previewOnly = false,
}: Props) {
  if (previewUrl) {
    return (
      <div className={cn("relative w-full overflow-hidden bg-white", heightClass, className)}>
        <iframe
          src={previewUrl}
          title={title ? `${title} preview` : "App preview"}
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[200%] max-w-none -translate-x-1/2 origin-top scale-[0.22] border-0"
        />
      </div>
    );
  }

  if (previewOnly) {
    return (
      <div
        className={cn("relative w-full bg-white", heightClass, className)}
        aria-hidden
      />
    );
  }

  const src = bannerSvg?.trim()
    ? `data:image/svg+xml,${encodeURIComponent(bannerSvg.trim())}`
    : `/api/projects/${projectId}/banner`;

  return (
    <div className={cn("relative w-full overflow-hidden bg-muted/30", heightClass, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-full object-cover object-top" loading="lazy" />
    </div>
  );
}
