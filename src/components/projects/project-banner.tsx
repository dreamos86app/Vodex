"use client";

import { cn } from "@/lib/utils";
import { resolvePreviewIframeUrl } from "@/lib/preview/preview-iframe-url-resolver";

type Props = {
  projectId: string;
  bannerSvg?: string | null;
  previewUrl?: string | null;
  title?: string;
  heightClass?: string;
  className?: string;
  /** When true and no preview URL, show designed placeholder instead of blank block. */
  previewOnly?: boolean;
  /** Imported app waiting on setup — softer empty state copy. */
  importedPendingSetup?: boolean;
  /** Optional app icon for placeholder mock. */
  iconSrc?: string | null;
};

function BannerPlaceholder({
  title,
  heightClass,
  className,
  importedPendingSetup,
  iconSrc,
}: {
  title?: string;
  heightClass: string;
  className?: string;
  importedPendingSetup?: boolean;
  iconSrc?: string | null;
}) {
  const label = title?.trim() || "Your app";
  const initial = label.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-gradient-to-br from-accent/10 via-surface to-sky-500/5",
        heightClass,
        className,
      )}
      aria-hidden={!title}
    >
      <div className="absolute inset-0 opacity-50">
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-accent/8 blur-2xl" />
        <div className="absolute -bottom-6 -left-6 size-24 rounded-full bg-sky-400/10 blur-xl" />
      </div>
      <div className="absolute inset-x-4 top-3 flex items-center gap-2 opacity-40">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/25" />
        <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
        <div className="h-2 w-2 rounded-full bg-muted-foreground/15" />
      </div>
      <div className="absolute inset-x-4 top-8 space-y-2 opacity-30">
        <div className="h-2 w-3/5 rounded-full bg-muted-foreground/15" />
        <div className="h-2 w-2/5 rounded-full bg-muted-foreground/10" />
      </div>
      <div className="relative flex h-full flex-col items-center justify-center gap-2 px-3 pb-3 pt-6 text-center">
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt=""
            className="size-9 rounded-xl object-cover shadow-sm ring-1 ring-border/60"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-[13px] font-bold text-accent ring-1 ring-accent/20">
            {initial}
          </div>
        )}
        <p className="max-w-full truncate text-[11px] font-semibold text-foreground/85">{label}</p>
        <p className="text-[9.5px] text-muted-foreground/80">
          {importedPendingSetup ? "Preview will appear after setup" : "Preview coming soon"}
        </p>
      </div>
    </div>
  );
}

export function ProjectBanner({
  projectId,
  bannerSvg,
  previewUrl,
  title,
  heightClass = "h-20",
  className,
  previewOnly = false,
  importedPendingSetup = false,
  iconSrc = null,
}: Props) {
  const resolution = previewUrl
    ? resolvePreviewIframeUrl({
        projectId,
        route: "/",
        candidates: [
          { source: "app_card.preview_url", url: previewUrl },
          {
            source: "generated_fallback",
            url: `/api/projects/${projectId}/preview-html?format=frame&route=${encodeURIComponent("/")}`,
          },
        ],
      })
    : null;
  const iframeSrc = resolution?.iframeSrc ?? null;
  if (iframeSrc) {
    return (
      <div className={cn("relative w-full overflow-hidden bg-muted/20", heightClass, className)}>
        <iframe
          key={`${projectId}-${resolution?.artifactId ?? "na"}-${resolution?.normalizedPreviewUrl ?? ""}`}
          src={iframeSrc}
          title={title ? `${title} preview` : "App preview"}
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[1280px] max-w-none -translate-x-1/2 -translate-y-1/2 origin-center scale-[0.17] border-0"
        />
      </div>
    );
  }

  if (bannerSvg?.trim()) {
    const src = `data:image/svg+xml,${encodeURIComponent(bannerSvg.trim())}`;
    return (
      <div className={cn("relative w-full overflow-hidden bg-muted/20", heightClass, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="size-full object-cover object-center" loading="lazy" />
      </div>
    );
  }

  if (previewOnly) {
    return (
      <BannerPlaceholder
        title={title}
        heightClass={heightClass}
        className={className}
        importedPendingSetup={importedPendingSetup}
        iconSrc={iconSrc}
      />
    );
  }

  return (
    <div className={cn("relative w-full overflow-hidden bg-muted/20", heightClass, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/projects/${projectId}/banner`}
        alt=""
        className="size-full object-cover object-center"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
