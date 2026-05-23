"use client";

import * as React from "react";
import { resolveSnapshotHtml } from "@/lib/publish/render-published-html";
import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";

export function PublicAppRenderer({
  title,
  description,
  publicUrl,
  files,
  version,
  showBadge = true,
}: {
  title: string;
  description: string | null;
  publicUrl: string;
  files: PublishedSnapshotFile[];
  version?: number;
  showBadge?: boolean;
}) {
  const html = React.useMemo(() => resolveSnapshotHtml(files), [files]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(false);
  }, [html]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-surface/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-semibold tracking-tight text-foreground">{title}</h1>
            {description && (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={publicUrl}
              aria-label="Public app URL"
              className="max-w-[220px] truncate rounded-lg bg-background px-2 py-1 text-[11px] ring-1 ring-border sm:max-w-xs"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(publicUrl)}
              className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Copy link
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium ring-1 ring-border"
            >
              Open
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        {loading && (
          <div className="mb-4 animate-pulse rounded-2xl bg-surface p-8 ring-1 ring-border">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="mt-3 h-3 w-2/3 rounded bg-muted" />
            <div className="mt-6 h-48 rounded-xl bg-muted/60" />
          </div>
        )}
        {loadError && (
          <div className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive ring-1 ring-destructive/20">
            {loadError}
          </div>
        )}
        {!html ? (
          <div className="rounded-2xl bg-surface px-6 py-12 text-center ring-1 ring-border">
            <p className="text-[14px] font-medium text-foreground">App not ready</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              This published app has no renderable entry page.
            </p>
          </div>
        ) : (
          <iframe
            title={title}
            srcDoc={html}
            className="h-[min(80vh,900px)] w-full rounded-2xl border border-border bg-white shadow-sm"
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => setLoading(false)}
            onError={() => setLoadError("Failed to load app preview")}
          />
        )}
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          {showBadge ? "Built with DreamOS86 · " : ""}
          {version != null ? `v${version} · ` : ""}
          Shareable public app
        </p>
      </main>
    </div>
  );
}
