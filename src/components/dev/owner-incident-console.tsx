"use client";

import * as React from "react";
import { AlertTriangle, Copy, X, ChevronDown, ChevronUp, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { buildOwnerFixPrompt } from "@/lib/dev/owner-incident-prompt";
import {
  clearOwnerIncidents,
  pushOwnerIncident,
  purgeStaleAuthIncidents,
  readOwnerIncidents,
  subscribeOwnerIncidents,
  syncDiagnosticsToOwnerIncidents,
  wireOwnerIncidentCapture,
  type OwnerIncident,
} from "@/lib/dev/owner-incident-store";
import {
  clearRuntimeDiagnostics,
  readRuntimeDiagnostics,
  reconcileRuntimeDiagnosticsWithProviderHealth,
} from "@/lib/dev/runtime-diagnostics";
import { toast } from "@/lib/toast";

export function OwnerIncidentConsole() {
  const email = useAuthStore((s) => s.profile?.email ?? s.user?.email);
  const isOwner = isDreamosOwnerEmail(email);
  const [incidents, setIncidents] = React.useState<OwnerIncident[]>([]);
  const [expanded, setExpanded] = React.useState(true);
  const [minimized, setMinimized] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!isOwner) return;
    wireOwnerIncidentCapture();
    let cancelled = false;
    void reconcileRuntimeDiagnosticsWithProviderHealth().then(() => {
      if (cancelled) return;
      purgeStaleAuthIncidents();
      syncDiagnosticsToOwnerIncidents();
      setIncidents(readOwnerIncidents());
    });
    const unsub = subscribeOwnerIncidents(() => {
      setIncidents(readOwnerIncidents());
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [isOwner]);

  React.useEffect(() => {
    if (!isOwner || incidents.length === 0) return;
    setMinimized(false);
    setExpanded(true);
  }, [isOwner, incidents.length]);

  const copyFixPrompt = React.useCallback(async () => {
    const prompt = buildOwnerFixPrompt({
      incidents,
      diagnostics: readRuntimeDiagnostics(),
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Fix prompt copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy prompt");
    }
  }, [incidents]);

  if (!isOwner || incidents.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed z-[200] flex flex-col shadow-2xl ring-1 ring-amber-500/40",
        minimized
          ? "bottom-4 left-4 max-w-[min(100vw-2rem,280px)] rounded-2xl bg-amber-950 text-amber-50"
          : "bottom-4 left-4 right-4 max-h-[min(70vh,520px)] max-w-lg rounded-2xl bg-amber-950 text-amber-50 sm:left-4 sm:right-auto",
      )}
      data-testid="owner-incident-console"
    >
      <div className="flex items-center gap-2 border-b border-amber-500/30 px-3 py-2.5">
        <Bug className="size-4 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold">Owner incident console</p>
          <p className="text-[10px] text-amber-200/80">
            {incidents.length} issue{incidents.length === 1 ? "" : "s"} · vodexlabs only
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="rounded-lg p-1 text-amber-200 hover:bg-amber-900"
          aria-label={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            clearOwnerIncidents();
            clearRuntimeDiagnostics();
            setIncidents([]);
          }}
          className="rounded-lg p-1 text-amber-200 hover:bg-amber-900"
          aria-label="Dismiss all"
        >
          <X className="size-4" />
        </button>
      </div>

      {!minimized && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-amber-500/20 px-3 py-2">
            <button
              type="button"
              onClick={() => void copyFixPrompt()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-amber-950"
            >
              <Copy className="size-3.5" />
              {copied ? "Copied" : "Copy fix prompt"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-amber-100 ring-1 ring-amber-500/40"
            >
              {expanded ? "Collapse" : "Expand"} log
            </button>
          </div>

          <div
            className={cn(
              "min-h-0 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed",
              expanded ? "max-h-[min(50vh,360px)]" : "max-h-24",
            )}
          >
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="mb-2 rounded-lg bg-amber-900/60 px-2.5 py-2 ring-1 ring-amber-500/20"
              >
                <p className="flex items-center gap-1.5 font-semibold text-amber-100">
                  <AlertTriangle className="size-3 shrink-0" />
                  <span className="uppercase">{inc.kind}</span>
                  <span className="font-normal text-amber-200/70">· {inc.title}</span>
                </p>
                <p className="mt-0.5 text-amber-300/60">{inc.at}</p>
                {inc.message ? (
                  <p className="mt-1 whitespace-pre-wrap break-all text-amber-100/90">{inc.message}</p>
                ) : null}
                {expanded && inc.stack ? (
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-amber-200/70">
                    {inc.stack}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Surface a caught error to the owner console (client-only). */
export function reportOwnerIncident(
  title: string,
  error: unknown,
  kind: OwnerIncident["kind"] = "render",
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  pushOwnerIncident({ kind, title, message, stack });
}
