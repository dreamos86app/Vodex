"use client";

import * as React from "react";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { notifyProjectCatalogUpdated } from "@/lib/projects/project-catalog-sync";

export function PublishVisibilitySettings({
  projectId,
  initialPublic,
  published,
}: {
  projectId: string;
  initialPublic: boolean;
  published?: boolean;
}) {
  const [isPublic, setIsPublic] = React.useState(initialPublic);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setIsPublic(initialPublic);
  }, [initialPublic, projectId]);

  async function save(next: boolean) {
    setSaving(true);
    setIsPublic(next);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_public: next }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save visibility");
      toast.success(next ? "App will appear in Explore when published" : "Community listing disabled");
      notifyProjectCatalogUpdated(projectId);
    } catch (err) {
      setIsPublic(!next);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface/80 p-4 ring-1 ring-border/80" data-testid="publish-visibility-settings">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
          <Globe className="size-5 text-accent" strokeWidth={1.65} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">Community visibility</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            When published, list your app on{" "}
            <Link href="/explore" className="font-medium text-accent hover:underline">
              Explore
            </Link>{" "}
            so others can discover it. This is separate from Community Templates.
          </p>
          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg bg-background/60 px-3 py-2.5 ring-1 ring-border/60">
            <input
              type="checkbox"
              checked={isPublic}
              disabled={saving}
              onChange={(e) => void save(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="text-[12px] font-medium text-foreground">
              List app in community when published
              {saving ? <Loader2 className="ml-2 inline size-3.5 animate-spin" /> : null}
            </span>
          </label>
          {!published ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Publish your app first — this setting takes effect on your live URL.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
