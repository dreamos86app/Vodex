"use client";

import * as React from "react";
import Image from "next/image";
import { HardDrive, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MediaAsset } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { isZipImportedAsset } from "@/lib/import/is-zip-imported-asset";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  projectId: string;
};

export function StorageDashboardPanel({ projectId }: Props) {
  const supabase = createClient();
  const [assets, setAssets] = React.useState<MediaAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [backfilling, setBackfilling] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadAssets = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/media-assets`, { credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as {
        assets?: MediaAsset[];
        error?: string;
      };
      if (!res.ok) {
        console.warn("[storage] media_assets API failed:", body.error);
        toast.error(body.error ?? "Could not load storage");
        setAssets([]);
      } else {
        setAssets(body.assets ?? []);
      }
    } catch {
      toast.error("Could not load storage");
      setAssets([]);
    }
    setLoading(false);
  }, [projectId]);

  React.useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  React.useEffect(() => {
    if (loading || assets.length > 0 || !projectId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/imported-assets/backfill`, {
          method: "POST",
        });
        const body = (await res.json().catch(() => ({}))) as {
          imported?: number;
          from_zip?: number;
          from_artifact?: number;
          errors?: string[];
        };
        if (res.ok && (body.imported ?? 0) > 0) {
          await loadAssets();
          toast.success(
            `Imported ${body.imported} asset${body.imported === 1 ? "" : "s"} (ZIP: ${body.from_zip ?? 0}, build: ${body.from_artifact ?? 0})`,
          );
        } else if (body.errors?.length) {
          toast.error(body.errors[0] ?? "Asset import found no files");
        }
      } catch {
        /* best-effort */
      }
    })();
  }, [loading, assets.length, loadAssets, projectId]);

  async function handleUpload(files: File[]) {
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("project_id", projectId);
      try {
        const res = await fetch("/api/media", { method: "POST", body: fd });
        if (res.ok) {
          const { asset } = (await res.json()) as { asset: MediaAsset };
          if (asset) setAssets((prev) => [asset, ...prev]);
        }
      } catch {
        /* best-effort */
      }
    }
    setUploading(false);
  }

  async function handleDelete(asset: MediaAsset) {
    setDeleting(asset.id);
    try {
      await fetch("/api/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id }),
      });
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch {
      /* best-effort */
    }
    setDeleting(null);
  }

  const imported = assets.filter((a) => isZipImportedAsset(a));
  const uploaded = assets.filter((a) => !isZipImportedAsset(a));
  const totalBytes = assets.reduce((sum, a) => sum + a.size_bytes, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function AssetGrid({ items, empty }: { items: MediaAsset[]; empty: string }) {
    if (items.length === 0) {
      return <p className="py-6 text-center text-[12px] text-muted-foreground">{empty}</p>;
    }
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((asset) => {
          const isImage = asset.mime_type.startsWith("image/");
          const fromZip = isZipImportedAsset(asset);
          return (
            <div
              key={asset.id}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface/40"
            >
              <div className="relative aspect-square bg-muted/30">
                {isImage ? (
                  <Image
                    src={asset.public_url}
                    alt={asset.filename}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                    {asset.mime_type.split("/")[1]?.toUpperCase() ?? "FILE"}
                  </div>
                )}
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-[11px] font-medium">{asset.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(asset.size_bytes)}
                  {fromZip ? " · ZIP import" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(asset)}
                disabled={deleting === asset.id}
                className={cn(
                  "absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100",
                  deleting === asset.id && "opacity-100",
                )}
                aria-label="Delete asset"
              >
                {deleting === asset.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ImageIcon className="size-3.5" strokeWidth={1.75} />
            {assets.length} asset{assets.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="size-3.5" strokeWidth={1.75} />
            {formatBytes(totalBytes)}
          </span>
          {imported.length > 0 ? (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              {imported.length} from ZIP import
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={async () => {
            setBackfilling(true);
            try {
              const res = await fetch(
                projectId
                  ? `/api/projects/${projectId}/imported-assets/backfill`
                  : "/api/projects/imported-assets/backfill-all",
                { method: "POST" },
              );
              const body = (await res.json().catch(() => ({}))) as {
                imported?: number;
                from_zip?: number;
                from_artifact?: number;
                errors?: string[];
                error?: string;
              };
              if (res.ok) {
                await loadAssets();
                if ((body.imported ?? 0) > 0) {
                  toast.success(
                    `Imported ${body.imported} asset${body.imported === 1 ? "" : "s"} (ZIP: ${body.from_zip ?? 0}, build: ${body.from_artifact ?? 0})`,
                  );
                } else if (body.errors?.length) {
                  toast.error(body.errors[0] ?? "No assets found in ZIP or build output");
                } else {
                  toast.error("No importable assets found — check ZIP contains images/fonts/animations");
                }
              } else {
                toast.error(body.error ?? body.errors?.[0] ?? "Import failed");
              }
            } catch {
              toast.error("Import from ZIP failed");
            }
            setBackfilling(false);
          }}
          disabled={backfilling}
          className="flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:bg-surface disabled:opacity-50"
        >
          {backfilling ? <Loader2 className="size-3.5 animate-spin" /> : <HardDrive className="size-3.5" />}
          {backfilling ? "Importing…" : "Import from ZIP"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,application/pdf,font/*,.woff,.woff2,.ttf,.otf"
          onChange={(e) => {
            if (e.target.files) void handleUpload(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleUpload(Array.from(e.dataTransfer.files));
        }}
        className="rounded-xl border border-dashed border-border/70 bg-surface/30 p-4"
      >
        <h3 className="mb-3 text-[13px] font-semibold">Imported from ZIP</h3>
        <AssetGrid items={imported} empty="No imported assets yet — re-import or run asset backfill." />
      </div>

      <div className="rounded-xl border border-border/60 bg-surface/30 p-4">
        <h3 className="mb-3 text-[13px] font-semibold">Uploaded assets</h3>
        <AssetGrid items={uploaded} empty="Drag files here or use Upload — images, fonts, and animations." />
      </div>
    </div>
  );
}
