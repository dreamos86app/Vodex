"use client";

import * as React from "react";
import { Monitor, RefreshCw, Share2, Smartphone, Tablet, ExternalLink, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Viewport = "desktop" | "tablet" | "mobile";

export function PreviewToolbar({
  previewUrl,
  onRefresh,
  onReloadIframe,
  loading,
  providerLabel,
  className,
  onViewportChange,
}: {
  previewUrl: string | null;
  onRefresh?: () => void;
  onReloadIframe?: () => void;
  loading?: boolean;
  providerLabel?: string;
  className?: string;
  onViewportChange?: (width: string) => void;
}) {
  const [viewport, setViewport] = React.useState<Viewport>("desktop");
  const [copied, setCopied] = React.useState(false);
  const width = viewport === "mobile" ? "390px" : viewport === "tablet" ? "768px" : "100%";

  React.useEffect(() => {
    onViewportChange?.(width);
  }, [width, onViewportChange]);

  const setVp = (vp: Viewport) => setViewport(vp);

  const copyLink = async () => {
    if (!previewUrl) return;
    await navigator.clipboard.writeText(previewUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const canShare = Boolean(previewUrl && (previewUrl.startsWith("http") || previewUrl.includes("/preview/")));

  return (
    <div className={cn("flex flex-col gap-2 border-b border-border/60 bg-surface/80 px-3 py-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setVp("desktop")}
            className={cn("rounded-lg p-1.5", viewport === "desktop" && "bg-background ring-1 ring-border")}
            aria-label="Desktop"
          >
            <Monitor className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setVp("tablet")}
            className={cn("rounded-lg p-1.5", viewport === "tablet" && "bg-background ring-1 ring-border")}
            aria-label="Tablet"
          >
            <Tablet className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setVp("mobile")}
            className={cn("rounded-lg p-1.5", viewport === "mobile" && "bg-background ring-1 ring-border")}
            aria-label="Mobile"
          >
            <Smartphone className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {providerLabel && <span className="text-[10px] text-muted-foreground">{providerLabel}</span>}
          {onReloadIframe && (
            <button
              type="button"
              onClick={onReloadIframe}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ring-1 ring-border"
            >
              <RotateCcw className="size-3.5" />
              Reload
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ring-1 ring-border"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          )}
          {canShare && previewUrl && (
            <>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ring-1 ring-border"
              >
                <ExternalLink className="size-3.5" />
                Open
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ring-1 ring-border"
              >
                <Share2 className="size-3.5" />
                {copied ? "Copied" : "Copy link"}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mx-auto w-full" style={{ maxWidth: width }}>
        <p className="truncate text-[10px] text-muted-foreground">
          {previewUrl ?? "No preview URL yet — start preview after generation"}
        </p>
      </div>
    </div>
  );
}
