"use client";

import * as React from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ThumbnailMode = "auto" | "route" | "upload";

export function OverviewPreviewThumbnailControl({
  projectId,
  previewUrl,
  routes = ["/"],
}: {
  projectId: string;
  previewUrl?: string | null;
  routes?: string[];
}) {
  const [mode, setMode] = React.useState<ThumbnailMode>("auto");
  const [route, setRoute] = React.useState(routes[0] ?? "/");
  const [saving, setSaving] = React.useState(false);
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(previewUrl ?? null);

  React.useEffect(() => {
    void fetch(`/api/projects/${projectId}/summary`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        const meta = (json as { metadata?: Record<string, unknown> }).metadata ?? {};
        const pu = meta.publish_ui as Record<string, unknown> | undefined;
        if (pu?.card_preview_mode === "route" || pu?.card_preview_mode === "upload" || pu?.card_preview_mode === "auto") {
          setMode(pu.card_preview_mode as ThumbnailMode);
        }
        if (typeof pu?.card_preview_route === "string") setRoute(pu.card_preview_route);
        if (typeof pu?.card_preview_url === "string") setThumbUrl(pu.card_preview_url);
      })
      .catch(() => {});
  }, [projectId]);

  async function save(next: { mode?: ThumbnailMode; route?: string; url?: string }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publish_ui: {
            card_preview_mode: next.mode ?? mode,
            card_preview_route: next.route ?? route,
            ...(next.url ? { card_preview_url: next.url } : {}),
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Preview image updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl bg-surface/90 p-4 ring-1 ring-border/70"
      data-testid="overview-preview-thumbnail-control"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Main preview image</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Shown on the Apps page card, templates, and marketplace listings.
          </p>
        </div>
        {saving ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <div className="relative h-20 w-32 overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-6 opacity-50" />
            </div>
          )}
        </div>

        <div className="min-w-[200px] flex-1 space-y-2">
          {(["auto", "route", "upload"] as const).map((m) => (
            <label
              key={m}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition hover:bg-accent/5",
                mode === m && "bg-accent/8 font-semibold text-accent",
              )}
            >
              <input
                type="radio"
                name="thumb-mode"
                checked={mode === m}
                onChange={() => {
                  setMode(m);
                  void save({ mode: m });
                }}
                className="accent-accent"
              />
              {m === "auto" ? "Auto home page screenshot" : m === "route" ? "Select route" : "Upload custom thumbnail"}
            </label>
          ))}

          {mode === "route" ? (
            <select
              value={route}
              onChange={(e) => {
                setRoute(e.target.value);
                void save({ route: e.target.value });
              }}
              className="w-full cursor-pointer rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
            >
              {routes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : null}

          {mode === "upload" ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-background px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border hover:ring-accent/30">
              <Upload className="size-3.5" />
              Upload image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  setThumbUrl(url);
                  void save({ url, mode: "upload" });
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
