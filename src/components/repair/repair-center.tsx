"use client";

import * as React from "react";
import Link from "next/link";
import { Wrench, Copy, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RepairIssue = {
  type: string;
  title: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  exactFix: string;
  severity: string;
  needsAi: boolean;
  estimatedCredits?: number;
  technicalDetails?: Record<string, unknown>;
  sqlFile?: string;
};

type RepairAction = {
  type: string;
  label: string;
  action: string;
  href?: string;
  sqlFile?: string;
  issueType?: string;
};

type RepairPayload = {
  issues: RepairIssue[];
  actions: RepairAction[];
  quotes?: Record<string, { estimatedCost: number; reservedEstimate: number; safeToRun: boolean }>;
  technicalBundle?: Record<string, unknown>;
  lastCheckpointId?: string | null;
  lifecycle?: string;
};

export function RepairCenter({
  projectId,
  className,
  compact,
  defaultOpen = true,
}: {
  projectId: string;
  className?: string;
  compact?: boolean;
  defaultOpen?: boolean;
}) {
  const [data, setData] = React.useState<RepairPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<string | null>(null);
  const [runResult, setRunResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [sqlPreview, setSqlPreview] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/projects/${projectId}/repair`)
      .then(async (r) => {
        if (r.status === 401) {
          setLoadError("Your session expired. Sign in again to run repairs.");
          return null;
        }
        if (!r.ok) throw new Error("Could not load repair status");
        return r.json() as Promise<RepairPayload>;
      })
      .then((j) => {
        if (j) setData(j);
      })
      .catch(() => setLoadError("Could not load repair status. Try again."))
      .finally(() => setLoading(false));
  }, [projectId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const copyTechnical = (issue: RepairIssue) => {
    const bundle = {
      projectId,
      issue: issue.type,
      ...issue.technicalDetails,
      adminBundle: data?.technicalBundle,
    };
    void navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
  };

  const runAction = async (action: RepairAction) => {
    if (action.href && action.action !== "run_ai_repair") return;
    setRunning(`${action.action}-${action.issueType ?? action.type}`);
    setRunResult(null);

    try {
      if (action.action === "show_sql") {
        const res = await fetch(`/api/projects/${projectId}/repair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "show_sql", issueType: action.issueType }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load SQL");
        setSqlPreview(json.sql ?? null);
        setRunResult({ ok: true, message: "SQL loaded — apply in Supabase SQL editor." });
        return;
      }

      if (action.action === "rollback_checkpoint") {
        if (!data?.lastCheckpointId) {
          setRunResult({ ok: false, message: "No checkpoint available to roll back." });
          return;
        }
        const res = await fetch(`/api/projects/${projectId}/repair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rollback_checkpoint",
            checkpointId: data.lastCheckpointId,
            issueType: action.issueType,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Rollback failed");
        setRunResult({ ok: true, message: `Restored ${json.restoredFiles ?? 0} files from checkpoint.` });
        load();
        return;
      }

      const res = await fetch(`/api/projects/${projectId}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.action, issueType: action.issueType ?? action.type }),
      });
      const json = await res.json();

      if (action.action === "run_ai_repair") {
        if (!res.ok) {
          throw new Error(json.error ?? "AI repair failed");
        }
        if (!json.repaired) {
          setRunResult({
            ok: false,
            message: json.reasons?.length
              ? `Repair ran but issues remain: ${json.reasons.slice(0, 2).join("; ")}`
              : "Repair completed but validation still has issues.",
          });
        } else {
          setRunResult({
            ok: true,
            message: `Repair succeeded — ${json.fileCount ?? 0} files updated. Status: ${json.lifecycle ?? "updated"}.`,
          });
        }
        load();
        return;
      }

      if (!res.ok) throw new Error(json.error ?? "Action failed");
      setRunResult({ ok: true, message: `${action.label} completed.` });
      load();
    } catch (e) {
      setRunResult({
        ok: false,
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl bg-surface p-3 text-[12px] text-muted-foreground ring-1 ring-border", className)}>
        <Loader2 className="size-4 animate-spin" />
        Checking for issues…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn("rounded-xl bg-destructive/5 p-4 ring-1 ring-destructive/20", className)}>
        <p className="text-[13px] font-medium text-destructive">{loadError}</p>
        <button type="button" onClick={load} className="mt-2 text-[12px] font-medium text-accent">
          Retry
        </button>
      </div>
    );
  }

  if (!data?.issues?.length) return null;

  return (
    <div className={cn("rounded-xl bg-amber-500/5 p-4 ring-1 ring-amber-500/20", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Wrench className="size-4 text-amber-600" strokeWidth={1.75} />
          Repair center
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(JSON.stringify(data.technicalBundle ?? data, null, 2))}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] ring-1 ring-border"
        >
          <Copy className="size-3" />
          Copy technical details
        </button>
      </div>

      {runResult && (
        <div
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]",
            runResult.ok ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive",
          )}
        >
          {runResult.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {runResult.message}
        </div>
      )}

      <ul className="mt-3 space-y-3">
        {data.issues.map((issue) => {
          const quote = data.quotes?.[issue.type];
          const issueActions = data.actions.filter((a) => a.issueType === issue.type || a.type === issue.type);
          return (
            <li key={issue.type} className="rounded-lg bg-surface/80 p-3 ring-1 ring-border/60">
              <p className="text-[13px] font-semibold text-foreground">{issue.title}</p>
              {!compact && (
                <>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">What happened: </span>
                    {issue.whatHappened ?? issue.summary}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">Why it matters: </span>
                    {issue.whyItMatters}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">Fix: </span>
                    {issue.exactFix}
                  </p>
                </>
              )}
              {compact && <p className="mt-0.5 text-[12px] text-muted-foreground">{issue.summary}</p>}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                AI needed: {issue.needsAi ? "Yes" : "No"}
                {issue.needsAi && quote && (
                  <span className="text-accent">
                    {" "}
                    · Estimated cost: {quote.estimatedCost} credits (up to {quote.reservedEstimate} reserved)
                  </span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {issueActions.map((a, idx) =>
                  a.href && a.action !== "run_ai_repair" ? (
                    <Link
                      key={`${a.action}-${idx}`}
                      href={a.href}
                      className="rounded-lg bg-background px-3 py-1.5 text-[11px] font-medium ring-1 ring-border hover:ring-accent/30"
                    >
                      {a.label}
                    </Link>
                  ) : (
                    <button
                      key={`${a.action}-${idx}`}
                      type="button"
                      disabled={Boolean(running)}
                      onClick={() => void runAction(a)}
                      className="inline-flex items-center gap-1 rounded-lg bg-background px-3 py-1.5 text-[11px] font-medium ring-1 ring-border disabled:opacity-50"
                    >
                      {running === `${a.action}-${a.issueType ?? a.type}` ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {a.label}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => copyTechnical(issue)}
                  className="rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground ring-1 ring-border"
                >
                  Copy technical details
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {sqlPreview && (
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-background p-2 text-[10px] ring-1 ring-border">
          {sqlPreview.slice(0, 4000)}
          {sqlPreview.length > 4000 ? "\n…" : ""}
        </pre>
      )}
    </div>
  );
}
