"use client";

import * as React from "react";
import { EditorFileTree, type FileTreeNode } from "@/components/editor/file-tree";
import { EditorTabs, type EditorTab } from "@/components/editor/editor-tabs";
import { AiDiffViewer } from "@/components/editor/ai-diff-viewer";
import { CheckpointTimeline } from "@/components/editor/checkpoint-timeline";
import { DeployWorkspacePanel } from "@/components/deploy/deploy-workspace-panel";
import type { DeployCheck } from "@/components/deploy/deploy-readiness-center";
import { PreviewWorkspace } from "@/components/preview/preview-workspace";
import { BuilderErrorPanel, type BuilderErrorItem } from "@/components/builder/builder-error-panel";
import { RepairCenter } from "@/components/repair/repair-center";
import { BuilderQualityStrip } from "@/components/builder/builder-quality-strip";
import { AppBlueprintPanel } from "@/components/build/app-blueprint-panel";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import type { EditorCheckpoint } from "@/lib/editor/checkpoints";
import type { FileDiff } from "@/lib/editor/diff";
import { loadEditorSession, saveEditorSession } from "@/lib/editor/editor-session";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Download, Save, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadProjectFileContent } from "@/lib/projects/load-project-files";
import { preferredEntryFile } from "@/lib/projects/imported-project-state";

export type BuilderFile = { path: string; content: string };

type Props = {
  projectId: string | null;
  projectName: string;
  files: BuilderFile[];
  loading?: boolean;
  blueprint?: AppBlueprint | null;
  previewUrl?: string | null;
  pendingDiffRefreshKey?: number;
  onFilesChanged?: () => void;
  className?: string;
};

export function AppBuilderWorkspace({
  projectId,
  projectName,
  files,
  loading,
  blueprint,
  previewUrl,
  pendingDiffRefreshKey = 0,
  onFilesChanged,
  className,
}: Props) {
  const [tabs, setTabs] = React.useState<EditorTab[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [dirtyPaths, setDirtyPaths] = React.useState<Set<string>>(new Set());
  const [editedPaths, setEditedPaths] = React.useState<Set<string>>(new Set());
  const [localContent, setLocalContent] = React.useState<Record<string, string>>({});
  const [savingPath, setSavingPath] = React.useState<string | null>(null);
  const [pendingDiffs, setPendingDiffs] = React.useState<FileDiff[]>([]);
  const [pendingSummary, setPendingSummary] = React.useState<string | null>(null);
  const [checkpoints, setCheckpoints] = React.useState<EditorCheckpoint[]>([]);
  const [errors, setErrors] = React.useState<BuilderErrorItem[]>([]);
  const [errorPaths, setErrorPaths] = React.useState<Set<string>>(new Set());
  const [deployChecks, setDeployChecks] = React.useState<DeployCheck[]>([]);
  const [readinessScore, setReadinessScore] = React.useState(0);
  const [qualityScore, setQualityScore] = React.useState<number | null>(null);
  const [polishQuote, setPolishQuote] = React.useState<{
    estimatedCost: number;
    safeToRun: boolean;
    label: string;
  } | null>(null);
  const [polishLoading, setPolishLoading] = React.useState(false);
  const [pendingDiffId, setPendingDiffId] = React.useState<string | null>(null);
  const [diffBusy, setDiffBusy] = React.useState(false);
  const [rollbackBusyId, setRollbackBusyId] = React.useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = React.useState<"files" | "code" | "tools">("code");
  const sessionRestored = React.useRef(false);
  const supabase = React.useMemo(() => createClient(), []);
  const [contentLoadingPath, setContentLoadingPath] = React.useState<string | null>(null);

  const pendingPaths = React.useMemo(
    () => new Set(pendingDiffs.map((d) => d.path)),
    [pendingDiffs],
  );

  const treeNodes: FileTreeNode[] = files.map((f) => ({
    path: f.path,
    dirty: dirtyPaths.has(f.path),
    generated: !editedPaths.has(f.path),
    edited: editedPaths.has(f.path),
    hasError: errorPaths.has(f.path),
    pendingChange: pendingPaths.has(f.path),
  }));

  const syncSession = React.useCallback(
    (nextTabs: EditorTab[], nextActive: string | null) => {
      if (!projectId) return;
      saveEditorSession(projectId, {
        tabs: nextTabs.map((t) => t.path),
        activePath: nextActive,
      });
    },
    [projectId],
  );

  React.useEffect(() => {
    if (!projectId || sessionRestored.current || files.length === 0) return;
    const session = loadEditorSession(projectId);
    sessionRestored.current = true;
    if (session?.tabs.length) {
      const valid = session.tabs.filter((p) => files.some((f) => f.path === p));
      if (valid.length > 0) {
        setTabs(valid.map((p) => ({ path: p, dirty: false })));
        const active =
          session.activePath && valid.includes(session.activePath) ? session.activePath : valid[0]!;
        setActivePath(active);
        return;
      }
    }
    const entry = preferredEntryFile(files.map((f) => f.path));
    if (entry) {
      setTabs([{ path: entry, dirty: false }]);
      setActivePath(entry);
    }
  }, [projectId, files]);

  React.useEffect(() => {
    if (!projectId || !activePath) return;
    const file = files.find((f) => f.path === activePath);
    if (localContent[activePath] !== undefined && localContent[activePath] !== "") return;
    if (file?.content) {
      setLocalContent((m) => ({ ...m, [activePath]: file.content }));
      return;
    }
    let cancelled = false;
    setContentLoadingPath(activePath);
    void loadProjectFileContent(supabase, projectId, activePath).then(({ content, error }) => {
      if (cancelled) return;
      if (error) toast.error(`Could not load ${activePath}`);
      else setLocalContent((m) => ({ ...m, [activePath]: content }));
      setContentLoadingPath(null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when path/project changes
  }, [activePath, projectId, files, supabase]);

  React.useEffect(() => {
    syncSession(tabs, activePath);
  }, [tabs, activePath, syncSession]);

  const openFile = (path: string) => {
    setTabs((prev) => {
      if (prev.find((t) => t.path === path)) return prev;
      return [...prev, { path, dirty: dirtyPaths.has(path) }];
    });
    setActivePath(path);
  };

  const closeTab = (path: string) => {
    if (dirtyPaths.has(path)) {
      const ok = window.confirm(`"${path.split("/").pop()}" has unsaved changes. Close anyway?`);
      if (!ok) return;
    }
    setTabs((t) => t.filter((x) => x.path !== path));
    if (activePath === path) {
      const rest = tabs.filter((x) => x.path !== path);
      setActivePath(rest[0]?.path ?? null);
    }
  };

  const displayContent = activePath
    ? localContent[activePath] ?? files.find((f) => f.path === activePath)?.content ?? ""
    : "";

  const onContentChange = (text: string) => {
    if (!activePath) return;
    setLocalContent((m) => ({ ...m, [activePath]: text }));
    const orig = files.find((f) => f.path === activePath)?.content ?? "";
    const isDirty = text !== orig;
    setDirtyPaths((d) => {
      const next = new Set(d);
      if (isDirty) next.add(activePath);
      else next.delete(activePath);
      return next;
    });
    setTabs((ts) => ts.map((t) => (t.path === activePath ? { ...t, dirty: isDirty } : t)));
  };

  const saveFile = async () => {
    if (!projectId || !activePath) return;
    const content = localContent[activePath] ?? displayContent;
    setSavingPath(activePath);
    try {
      const res = await fetch("/api/editor/apply-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          patches: [{ path: activePath, content }],
          validateAfterApply: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDirtyPaths((d) => {
        const n = new Set(d);
        n.delete(activePath);
        return n;
      });
      setEditedPaths((e) => new Set(e).add(activePath));
      setTabs((ts) => ts.map((t) => (t.path === activePath ? { ...t, dirty: false } : t)));
      if (data.validationOk === false) {
        toast.warning(`Saved, but validation flagged: ${(data.validationReasons ?? []).join(", ")}`);
      } else {
        toast.success("Saved");
      }
      onFilesChanged?.();
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "Try again"}`);
      setErrors((errs) => [
        ...errs,
        { id: `save-${Date.now()}`, title: "Save failed", message: String(e), severity: "error" },
      ]);
    } finally {
      setSavingPath(null);
    }
  };

  const loadCheckpoints = React.useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/editor/checkpoints?projectId=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setCheckpoints((data.checkpoints ?? []) as EditorCheckpoint[]);
    }
  }, [projectId]);

  const loadPreviewErrors = React.useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/preview-errors`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { errors?: Array<{ file?: string }> };
    const paths = new Set(
      (data.errors ?? []).map((e) => e.file).filter((f): f is string => Boolean(f)),
    );
    setErrorPaths(paths);
  }, [projectId]);

  React.useEffect(() => {
    void loadCheckpoints();
    void loadPreviewErrors();
  }, [loadCheckpoints, loadPreviewErrors]);

  const loadPendingDiff = React.useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/editor/pending-diff?projectId=${projectId}`);
    if (!res.ok) return;
    const data = await res.json();
    const pending = data.pending as {
      id: string;
      diffs: FileDiff[];
      summary: string;
    } | null;
    if (pending?.diffs?.length) {
      setPendingDiffs(pending.diffs);
      setPendingDiffId(pending.id);
      setPendingSummary(pending.summary);
      setMobilePanel("code");
      toast.info(`Review AI changes: ${pending.summary}`);
    } else {
      setPendingDiffs([]);
      setPendingDiffId(null);
      setPendingSummary(null);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadPendingDiff();
  }, [loadPendingDiff, pendingDiffRefreshKey]);

  React.useEffect(() => {
    if (!projectId || files.length === 0) {
      setPolishQuote(null);
      return;
    }
    fetch("/api/build/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, confirm: false }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.quoteOnly) {
          setPolishQuote({
            estimatedCost: d.estimatedCost,
            safeToRun: d.safeToRun,
            label: d.label,
          });
        }
      })
      .catch(() => setPolishQuote(null));
  }, [projectId, files.length]);

  const createCheckpoint = async (label: string, stage: EditorCheckpoint["stage"], changedPaths?: string[]) => {
    if (!projectId) return;
    await fetch("/api/editor/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        label,
        stage,
        files: files.map((f) => ({ path: f.path, content: f.content })),
        changedPaths,
      }),
    });
    await loadCheckpoints();
  };

  const syncPendingStatus = async (status: "applied" | "rejected") => {
    if (!projectId || !pendingDiffId) return;
    await fetch("/api/editor/pending-diff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, diffId: pendingDiffId, status }),
    });
    setPendingDiffId(null);
    setPendingSummary(null);
  };

  const acceptDiff = async (path: string) => {
    const diff = pendingDiffs.find((d) => d.path === path);
    if (!diff || !projectId || diffBusy) return;
    setDiffBusy(true);
    try {
      await createCheckpoint(`Before edit: ${path}`, "pre_edit", [path]);
      const res = await fetch("/api/editor/apply-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          patches: [{ path, content: diff.after }],
          validateAfterApply: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      const remaining = pendingDiffs.filter((x) => x.path !== path);
      setPendingDiffs(remaining);
      setLocalContent((m) => {
        const next = { ...m };
        delete next[path];
        return next;
      });
      setDirtyPaths((d) => {
        const n = new Set(d);
        n.delete(path);
        return n;
      });
      if (remaining.length === 0) {
        await syncPendingStatus("applied");
      } else if (pendingDiffId) {
        await fetch("/api/editor/pending-diff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, diffId: pendingDiffId, remainingDiffs: remaining }),
        });
      }
      if (data.validationOk === false) {
        toast.warning(`Applied with validation notes: ${(data.validationReasons ?? []).join(", ")}`);
      } else {
        toast.success(`Applied ${path}`);
      }
      onFilesChanged?.();
      void loadPreviewErrors();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply changes");
    } finally {
      setDiffBusy(false);
    }
  };

  const rejectDiff = async (path: string) => {
    const remaining = pendingDiffs.filter((x) => x.path !== path);
    setPendingDiffs(remaining);
    if (remaining.length === 0) {
      await syncPendingStatus("rejected");
      toast.info("Changes rejected — nothing was modified");
    } else if (projectId && pendingDiffId) {
      await fetch("/api/editor/pending-diff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, diffId: pendingDiffId, remainingDiffs: remaining }),
      }).catch(() => undefined);
    }
  };

  const rejectAllDiffs = async () => {
    setPendingDiffs([]);
    await syncPendingStatus("rejected");
    toast.info("All proposed changes rejected");
  };

  const acceptAllDiffs = async () => {
    for (const d of [...pendingDiffs]) {
      await acceptDiff(d.path);
    }
  };

  const runPolish = async () => {
    if (!projectId || polishLoading) return;
    setPolishLoading(true);
    try {
      await createCheckpoint("Before polish", "pre_polish");
      const res = await fetch("/api/build/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Polish failed");
      if (data.diffs?.length) {
        setPendingDiffs(data.diffs);
        setPendingSummary(data.message ?? "Polish suggestions");
        toast.info("Review polish changes before applying");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Polish failed");
    } finally {
      setPolishLoading(false);
    }
  };

  React.useEffect(() => {
    if (!projectId || files.length === 0) return;
    fetch("/api/deploy/readiness?projectId=" + projectId)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setReadinessScore(data.readinessScore ?? 0);
        setDeployChecks(
          (data.checks ?? []).map((c: { id: string; title: string; detail: string; severity: string }) => ({
            id: c.id,
            label: c.title,
            detail: c.detail,
            status: c.severity === "error" ? "blocked" : c.severity === "warning" ? "warning" : "ok",
          })),
        );
      })
      .catch(() => undefined);

    import("@/lib/quality/app-quality-score").then(({ scoreAppQuality }) => {
      const s = scoreAppQuality({
        files,
        hasAuth: files.some((f) => /auth|login/i.test(f.path + f.content)),
        hasLoadingStates: files.some((f) => /loading|skeleton|spinner/i.test(f.content)),
      });
      setQualityScore(s.scorePercent);
    });
  }, [projectId, files]);

  const rollbackCheckpoint = async (cpId: string) => {
    const cp = checkpoints.find((c) => c.id === cpId);
    if (!cp || !projectId || rollbackBusyId) return;
    setRollbackBusyId(cpId);
    try {
      const res = await fetch("/api/editor/apply-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, patches: cp.files }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Rollback failed");
      }
      toast.success(`Restored: ${cp.label}`);
      setLocalContent({});
      setDirtyPaths(new Set());
      setTabs((ts) => ts.map((t) => ({ ...t, dirty: false })));
      onFilesChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setRollbackBusyId(null);
    }
  };

  return (
    <div className={cn("builder-shell flex h-full min-h-0 flex-col overflow-x-hidden", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-foreground">{projectName}</p>
          <p className="text-[10px] text-muted-foreground">
            {files.length} files
            {pendingDiffs.length > 0 ? ` · ${pendingDiffs.length} pending review` : ""}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {qualityScore != null ? <BuilderQualityStrip score={qualityScore} /> : null}
          {projectId && files.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={polishLoading || polishQuote?.safeToRun === false}
              onClick={() => void runPolish()}
            >
              {polishLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Polish UI
            </Button>
          ) : null}
          {projectId ? (
            <Button type="button" size="sm" variant="secondary" asChild>
              <a
                href="/api/deploy/export"
                onClick={(e) => {
                  e.preventDefault();
                  fetch("/api/deploy/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId }),
                  })
                    .then((r) => r.blob())
                    .then((blob) => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `dreamos-${projectId.slice(0, 8)}.zip`;
                      a.click();
                    });
                }}
              >
                <Download className="size-3.5" />
                Export
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void saveFile()}
            disabled={!activePath || !dirtyPaths.has(activePath ?? "") || savingPath !== null}
          >
            <Save className="size-3.5" />
            {savingPath ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {blueprint ? <AppBlueprintPanel blueprint={blueprint} className="mx-2 mt-2 shrink-0" /> : null}

      <div className="builder-mobile-panel flex shrink-0 gap-1 border-b border-border px-2 py-1.5 lg:hidden">
        {(["files", "code", "tools"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold capitalize",
              mobilePanel === p ? "bg-accent text-white" : "bg-surface text-muted-foreground ring-1 ring-border",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_1fr_280px]">
        <EditorFileTree
          files={treeNodes}
          selectedPath={activePath}
          onSelect={(p) => {
            openFile(p);
            setMobilePanel("code");
          }}
          className={cn("border-r border-border", mobilePanel !== "files" && "hidden lg:flex")}
        />

        <div className={cn("flex min-h-0 min-w-0 flex-col", mobilePanel !== "code" && "hidden lg:flex")}>
          <EditorTabs
            tabs={tabs}
            activePath={activePath}
            savingPath={savingPath}
            onSelect={setActivePath}
            onClose={closeTab}
          />
          {pendingDiffs.length > 0 ? (
            <div className="border-b border-border p-2">
              <AiDiffViewer
                diffs={pendingDiffs}
                summary={pendingSummary}
                busy={diffBusy}
                onAccept={(p) => void acceptDiff(p)}
                onReject={(p) => void rejectDiff(p)}
                onAcceptAll={() => void acceptAllDiffs()}
                onRejectAll={() => void rejectAllDiffs()}
              />
            </div>
          ) : null}
          <textarea
            className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground outline-none"
            value={displayContent}
            onChange={(e) => onContentChange(e.target.value)}
            readOnly={!activePath || pendingPaths.has(activePath)}
            placeholder={
              loading
                ? "Loading files…"
                : activePath && pendingPaths.has(activePath)
                  ? "Accept or reject AI changes first"
                  : "Select a file"
            }
          />
          {projectId && files.length > 0 ? (
            <PreviewWorkspace
              projectId={projectId}
              previewUrl={previewUrl}
              hasGenerated={files.length > 0}
              autoStart={false}
              className="h-[400px] shrink-0 border-t border-border"
            />
          ) : null}
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-border p-2",
            mobilePanel !== "tools" && "hidden lg:flex",
          )}
        >
          {projectId ? <RepairCenter projectId={projectId} compact /> : null}
          <BuilderErrorPanel
            errors={errors}
            onFixWithAi={() => {
              if (projectId) {
                void fetch(`/api/projects/${projectId}/repair`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "run_ai_repair", issueType: "validation_failed" }),
                })
                  .then((r) => r.json())
                  .then((j) => {
                    if (j.ok && j.repaired) toast.success("AI repair completed");
                    else toast.error(j.error ?? "AI repair could not complete");
                  });
              }
            }}
          />
          {projectId ? (
            <DeployWorkspacePanel
              projectId={projectId}
              checks={deployChecks}
              readinessScore={readinessScore}
            />
          ) : null}
          <div className="rounded-xl border border-border p-2">
            <p className="mb-2 text-[11px] font-semibold text-foreground">Checkpoints</p>
            <CheckpointTimeline
              checkpoints={checkpoints}
              busyId={rollbackBusyId}
              onRollback={(id) => void rollbackCheckpoint(id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
