"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, RotateCcw, Loader2, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { VodexConfirmModal } from "@/components/ui/vodex-confirm-modal";

type VersionRow = {
  id: string;
  version_number: number;
  summary: string | null;
  mode: string | null;
  credit_cost: number | null;
  changed_paths: string[] | null;
  created_at: string;
  published_at?: string | null;
};

function versionLabel(v: VersionRow, index: number, total: number): string {
  if (index === 0) return "Current version";
  if (v.published_at) return "Published version";
  if (v.mode === "restore") return "Restored version";
  if (index === total - 1) return "Previous version";
  return `Version ${v.version_number}`;
}

export function VersionHistoryDrawer({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [versions, setVersions] = React.useState<VersionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

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
    if (!open) return;
    void load();
  }, [open, load]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      setConfirmId(null);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-foreground/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[var(--z-drawer)] flex w-full max-w-md flex-col bg-background shadow-2xl ring-1 ring-border"
            data-testid="version-history-drawer"
            role="dialog"
            aria-label="Version history"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <History className="size-5 text-accent" />
                <h2 className="text-[15px] font-semibold">Version history</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading versions…
                </div>
              ) : versions.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">
                  No saved versions yet. Builds create snapshots automatically.
                </p>
              ) : (
                <ul className="space-y-3">
                  {versions.map((v, i) => (
                    <li
                      key={v.id}
                      className="rounded-xl bg-surface/80 p-3.5 ring-1 ring-border/70"
                      data-testid={`version-row-${v.version_number}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">
                            {versionLabel(v, i, versions.length)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            v{v.version_number} · {new Date(v.created_at).toLocaleString()}
                          </p>
                          {v.published_at ? (
                            <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Published
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {v.summary ? (
                        <p className="mt-2 text-[12px] text-muted-foreground">{v.summary}</p>
                      ) : null}
                      {v.changed_paths?.length ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {v.changed_paths.length} file{v.changed_paths.length === 1 ? "" : "s"} changed
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {i > 0 ? (
                          <button
                            type="button"
                            disabled={restoring === v.id}
                            onClick={() => setConfirmId(v.id)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20 hover:bg-accent hover:text-white"
                          >
                            {restoring === v.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3" />
                            )}
                            Restore
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border opacity-60"
                        >
                          <GitCompare className="size-3" />
                          Compare
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>

          <VodexConfirmModal
            open={Boolean(confirmId)}
            title="Restore this version?"
            description="Your project files will be replaced with this snapshot. Credits are not refunded."
            confirmLabel="Restore version"
            loading={Boolean(restoring)}
            onCancel={() => setConfirmId(null)}
            onConfirm={() => {
              if (confirmId) void restore(confirmId);
            }}
          />
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Top builder toolbar button */
export function VersionHistoryEntryButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="version-history-entrypoint"
      title="Version history"
      aria-label="Version history"
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-transparent transition",
        "hover:bg-surface hover:text-foreground hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
        className,
      )}
    >
      <History className="size-3.5 text-accent" strokeWidth={1.75} />
      <span className="hidden sm:inline">Versions</span>
    </button>
  );
}
