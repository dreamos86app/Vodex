"use client";

import * as React from "react";
import { History, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type VersionRow = {
  id: string;
  version_number: number;
  summary: string | null;
  mode: string | null;
  credit_cost: number | null;
  changed_paths: string[] | null;
  created_at: string;
};

export function AppVersionHistoryPanel({ projectId }: { projectId: string }) {
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [restoring, setRestoring] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, { credentials: "include" });
      const body = (await res.json()) as { versions?: VersionRow[] };
      setVersions(body.versions ?? []);
    } catch {
      toast.error("Could not load version history.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function restore(versionId: string) {
    setRestoring(versionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", versionId }),
      });
      if (!res.ok) {
        toast.error("Restore failed.");
        return;
      }
      toast.success("Version restored — credits are not refunded.");
      await load();
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background/80 p-3">
      <div className="mb-2 flex items-center gap-2">
        <History className="size-4 text-accent" strokeWidth={1.75} />
        <h3 className="text-[13px] font-semibold text-foreground">Version history</h3>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[12px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : versions.length === 0 ? (
        <p className="py-3 text-[12px] text-muted-foreground">No saved versions yet. Builds create snapshots automatically.</p>
      ) : (
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-surface/60 px-2.5 py-2 ring-1 ring-border/60"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">
                  v{v.version_number}
                  {v.mode ? <span className="text-muted-foreground"> · {v.mode}</span> : null}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {v.summary ?? "Snapshot"}
                  {v.changed_paths?.length ? ` · ${v.changed_paths.length} files` : ""}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {new Date(v.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={restoring === v.id}
                onClick={() => void restore(v.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-accent ring-1 ring-accent/30 transition hover:bg-accent/10",
                  restoring === v.id && "opacity-60",
                )}
              >
                {restoring === v.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
