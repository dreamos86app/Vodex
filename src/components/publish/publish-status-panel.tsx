"use client";

import * as React from "react";
import { ExternalLink, History, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RepairCenter } from "@/components/repair/repair-center";

type PublishVersion = { version: number; publishedAt: string; publicUrl: string };

export function PublishStatusPanel({
  projectId,
  slug,
  publicUrl,
  status,
  versions,
  readinessBlockers,
  onSlugChange,
  className,
}: {
  projectId: string;
  slug?: string | null;
  publicUrl?: string | null;
  status: "draft" | "ready" | "published" | "blocked";
  versions?: PublishVersion[];
  readinessBlockers?: string[];
  onSlugChange?: (slug: string) => void;
  className?: string;
}) {
  const [customSlug, setCustomSlug] = React.useState(slug ?? "");
  const [slugStatus, setSlugStatus] = React.useState<"idle" | "checking" | "ok" | "error">("idle");
  const [slugMessage, setSlugMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (slug) setCustomSlug(slug);
  }, [slug]);

  const checkSlug = React.useCallback(async () => {
    const value = customSlug.trim();
    if (!value) return;
    setSlugStatus("checking");
    setSlugMessage(null);
    try {
      const res = await fetch("/api/publish/check-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: value, projectId }),
      });
      const data = (await res.json()) as { ok?: boolean; reserved?: boolean; taken?: boolean; slug?: string };
      if (data.reserved) {
        setSlugStatus("error");
        setSlugMessage("Reserved slug — choose another");
      } else if (data.taken) {
        setSlugStatus("error");
        setSlugMessage("Slug already taken");
      } else if (data.ok && data.slug) {
        setSlugStatus("ok");
        setSlugMessage("Slug available");
        setCustomSlug(data.slug);
        onSlugChange?.(data.slug);
      } else {
        setSlugStatus("error");
        setSlugMessage("Invalid slug");
      }
    } catch {
      setSlugStatus("error");
      setSlugMessage("Could not check slug");
    }
  }, [customSlug, projectId, onSlugChange]);

  return (
    <div className={cn("rounded-xl bg-surface p-4 ring-1 ring-border", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Globe className="size-4 text-accent" />
        Publish
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {status === "published" && publicUrl
          ? "Your app is live and shareable."
          : status === "ready"
            ? "App passed readiness — you can publish."
            : status === "blocked"
              ? "Publish blocked until readiness checks pass."
              : "Generate, preview, and validate your app before publishing."}
      </p>

      {status !== "published" && (
        <div className="mt-3 space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Public slug</label>
          <div className="flex gap-2">
            <input
              value={customSlug}
              onChange={(e) => {
                setCustomSlug(e.target.value);
                setSlugStatus("idle");
                setSlugMessage(null);
              }}
              placeholder="my-app"
              className="flex-1 rounded-lg bg-background px-2 py-1.5 text-[12px] ring-1 ring-border"
            />
            <button
              type="button"
              onClick={() => void checkSlug()}
              disabled={slugStatus === "checking" || !customSlug.trim()}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] ring-1 ring-border disabled:opacity-50"
            >
              {slugStatus === "checking" ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Check
            </button>
          </div>
          {slugMessage && (
            <p
              className={cn(
                "text-[10px]",
                slugStatus === "ok" ? "text-positive" : slugStatus === "error" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {slugMessage}
            </p>
          )}
        </div>
      )}

      {slug && status === "published" && (
        <p className="mt-2 text-[11px]">
          Slug: <code className="rounded bg-background px-1 py-0.5">{slug}</code>
        </p>
      )}

      {readinessBlockers && readinessBlockers.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-destructive">
          {readinessBlockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      {(status === "blocked" || (readinessBlockers && readinessBlockers.length > 0)) && (
        <RepairCenter projectId={projectId} className="mt-3" compact />
      )}

      {publicUrl && status === "published" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            <ExternalLink className="size-3.5" />
            Open public app
          </a>
        </div>
      )}

      {versions && versions.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <History className="size-3.5" />
            Version history
          </p>
          <ul className="mt-1 space-y-1 text-[10px] text-muted-foreground">
            {versions.slice(0, 5).map((v) => (
              <li key={v.version}>
                v{v.version} · {new Date(v.publishedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
