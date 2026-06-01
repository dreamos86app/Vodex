"use client";

import * as React from "react";
import { Copy, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  buildRouteErrorFixPrompt,
  buildSanitizedCrashReport,
} from "@/lib/dev/route-error-fix-prompt";
import {
  collectRouteErrorContext,
  persistRouteErrorPayload,
  type RouteErrorBoundary,
  type RouteErrorPayload,
} from "@/lib/dev/route-error-context";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";
import { pushOwnerIncident } from "@/lib/dev/owner-incident-store";

type OwnerGate = "unknown" | "owner" | "not-owner";

export function RouteErrorOwnerDiagnostics({
  error,
  boundary,
  className,
}: {
  error: Error & { digest?: string };
  boundary: RouteErrorBoundary;
  className?: string;
}) {
  const authEmail = useAuthStore((s) => s.profile?.email ?? s.user?.email ?? null);
  const [ownerGate, setOwnerGate] = React.useState<OwnerGate>(() =>
    isDreamosOwnerEmail(authEmail) ? "owner" : "unknown",
  );
  const [payload, setPayload] = React.useState<RouteErrorPayload | null>(null);
  const [copied, setCopied] = React.useState<"fix" | "report" | null>(null);

  React.useEffect(() => {
    const ctx = collectRouteErrorContext(error, boundary);
    setPayload(ctx);
    persistRouteErrorPayload(ctx);
    pushRuntimeDiagnostic("error_boundary", {
      boundary,
      message: error.message,
      digest: error.digest,
      route: ctx.route,
      projectId: ctx.projectId,
    });
    pushOwnerIncident({
      kind: "render",
      title: `Route error (${boundary})`,
      message: error.message,
      stack: error.stack,
      route: ctx.route,
      meta: {
        autostart: ctx.autostart,
        strategy: ctx.strategy,
        conversationId: ctx.conversationId,
      },
    });
    console.error(`[Vodex] Route error (${boundary}):`, error);
  }, [error, boundary]);

  React.useEffect(() => {
    if (isDreamosOwnerEmail(authEmail)) {
      setOwnerGate("owner");
      return;
    }
    let cancelled = false;
    void fetch("/api/account/identity", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ownerEmail?: string } | null) => {
        if (cancelled) return;
        if (json?.ownerEmail && isDreamosOwnerEmail(json.ownerEmail)) {
          setOwnerGate("owner");
        } else if (json?.ownerEmail) {
          setOwnerGate("not-owner");
        }
      })
      .catch(() => {
        if (!cancelled) setOwnerGate("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [authEmail]);

  const isOwner = ownerGate === "owner";
  const showFull = isOwner && payload != null;

  const copyText = React.useCallback(
    async (mode: "fix" | "report") => {
      if (!payload) return;
      const text =
        mode === "fix" && isOwner
          ? buildRouteErrorFixPrompt(payload, { ownerEmail: authEmail })
          : buildSanitizedCrashReport(payload);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(mode);
        window.setTimeout(() => setCopied(null), 2000);
      } catch {
        /* ignore */
      }
    },
    [authEmail, isOwner, payload],
  );

  if (!payload) return null;

  return (
    <div
      className={cn(
        "mt-6 w-full max-w-2xl rounded-xl text-left ring-1",
        showFull
          ? "bg-amber-950/95 text-amber-50 ring-amber-500/40"
          : "bg-surface text-foreground ring-border",
        className,
      )}
      data-testid="route-error-owner-diagnostics"
      data-owner={isOwner ? "true" : "false"}
    >
      <div className="flex items-start gap-2 border-b border-amber-500/20 px-4 py-3">
        <ShieldAlert className={cn("size-4 shrink-0 mt-0.5", showFull ? "text-amber-300" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold">
            {showFull ? "Owner crash diagnostics" : "Crash report"}
          </p>
          <p className={cn("text-[10px]", showFull ? "text-amber-200/80" : "text-muted-foreground")}>
            {showFull
              ? "Full details — use Copy full fix prompt for Cursor."
              : "Limited details. Sign in as platform owner for full diagnostics."}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 font-mono text-[10.5px] leading-relaxed">
        <Row label="message" value={payload.message} full={showFull} />
        {showFull && payload.name ? <Row label="name" value={payload.name} full /> : null}
        {showFull && payload.stack ? (
          <div>
            <p className="mb-1 font-semibold text-amber-200/90">stack</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-2 text-[10px]">
              {payload.stack}
            </pre>
          </div>
        ) : null}
        <Row label="route" value={payload.route ?? "—"} full={showFull} />
        {showFull ? (
          <>
            <Row label="project_id" value={payload.projectId ?? "—"} full />
            <Row label="autostart" value={payload.autostart ?? "—"} full />
            <Row label="strategy" value={payload.strategy ?? "—"} full />
            <Row label="conversationId" value={payload.conversationId ?? "—"} full />
            <Row label="jobId" value={payload.jobId ?? "—"} full />
            <Row label="at" value={payload.at} full />
            {payload.digest ? <Row label="digest" value={payload.digest} full /> : null}
            {Object.keys(payload.searchParams ?? {}).length > 0 ? (
              <div>
                <p className="mb-1 font-semibold text-amber-200/90">search_params</p>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-2 text-[10px]">
                  {JSON.stringify(payload.searchParams, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        ) : payload.digest ? (
          <Row label="digest" value={payload.digest} full={false} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-amber-500/20 px-4 py-3">
        {showFull ? (
          <button
            type="button"
            onClick={() => void copyText("fix")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-amber-950"
            data-testid="copy-full-fix-prompt"
          >
            <Copy className="size-3.5" />
            {copied === "fix" ? "Copied" : "Copy full fix prompt"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void copyText("report")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold ring-1",
            showFull
              ? "bg-amber-900/60 text-amber-100 ring-amber-500/30"
              : "bg-accent text-white ring-accent/30",
          )}
          data-testid="copy-crash-report"
        >
          <Copy className="size-3.5" />
          {copied === "report" ? "Copied" : "Copy crash report"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: string; full: boolean }) {
  return (
    <div>
      <span className={cn("font-semibold", full ? "text-amber-200/90" : "text-muted-foreground")}>
        {label}:{" "}
      </span>
      <span className={cn("break-all", full ? "text-amber-50" : "text-foreground")}>{value}</span>
    </div>
  );
}
