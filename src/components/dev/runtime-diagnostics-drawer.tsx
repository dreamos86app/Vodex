"use client";

import * as React from "react";
import { X, Copy, Trash2, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearRuntimeDiagnostics,
  readRuntimeDiagnostics,
  type RuntimeDiagnosticEntry,
} from "@/lib/dev/runtime-diagnostics";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { truncateIdentityId } from "@/lib/identity/dreamos-identity";
import { copyTextToClipboard } from "@/lib/clipboard/copy-text";
import { toast } from "@/lib/toast";

function IdentitySummaryStrip() {
  const [summary, setSummary] = React.useState<{
    accountId?: string;
    workspaceId?: string;
    projectRef?: string | null;
    appEnv?: string;
    ownerEmail?: string | null;
  } | null>(null);

  React.useEffect(() => {
    void fetch("/api/account/identity", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.accountId) {
          setSummary({
            accountId: json.accountId,
            workspaceId: json.workspaceId,
            ownerEmail: json.ownerEmail,
          });
        }
      })
      .catch(() => {});
    void fetch("/api/admin/runtime-diagnostics-bundle", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) {
          setSummary((prev) => ({
            accountId: json.accountId ?? prev?.accountId,
            workspaceId: json.workspaceId ?? prev?.workspaceId,
            projectRef: json.projectRef ?? null,
            appEnv: json.appEnv,
            ownerEmail: json.ownerEmail ?? prev?.ownerEmail,
          }));
        }
      })
      .catch(() => {});
  }, []);

  if (!summary?.accountId) return null;

  return (
    <div className="space-y-1 border-b border-border px-5 py-3 text-[10px] text-muted-foreground">
      <p>
        <span className="text-foreground/80">accountId</span>{" "}
        <span className="font-mono" title={summary.accountId}>
          {truncateIdentityId(summary.accountId)}
        </span>
      </p>
      <p>
        <span className="text-foreground/80">workspaceId</span>{" "}
        <span className="font-mono" title={summary.workspaceId}>
          {summary.workspaceId ? truncateIdentityId(summary.workspaceId) : "—"}
        </span>
      </p>
      {summary.projectRef ? (
        <p>
          <span className="text-foreground/80">projectRef</span> {summary.projectRef}
        </p>
      ) : null}
      {summary.appEnv ? (
        <p>
          <span className="text-foreground/80">appEnv</span> {summary.appEnv}
        </p>
      ) : null}
      {summary.ownerEmail ? (
        <p className="truncate">
          <span className="text-foreground/80">email</span> {summary.ownerEmail}
        </p>
      ) : null}
    </div>
  );
}

/** Owner-only runtime diagnostics — center-left launcher, centered modal (not a right drawer). */
export function RuntimeDiagnosticsDrawer() {
  const email = useAuthStore((s) => s.profile?.email);
  const isOwner = isDreamosOwnerEmail(email);
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<RuntimeDiagnosticEntry[]>([]);
  const [fallbackText, setFallbackText] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setEntries(readRuntimeDiagnostics());
  }, []);

  React.useEffect(() => {
    if (!isOwner || !open) return;
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [isOwner, open, refresh]);

  const copyBundle = async () => {
    const local = readRuntimeDiagnostics();
    let server: unknown = null;
    try {
      const r = await fetch("/api/admin/runtime-diagnostics-bundle", {
        credentials: "include",
      });
      if (r.ok) server = await r.json();
    } catch {
      /* ignore */
    }
    const bundle = { client: local, server, copied_at: new Date().toISOString() };
    const text = JSON.stringify(bundle, null, 2);
    const result = await copyTextToClipboard(text);
    if (result.ok) {
      toast.success(`Copied ${result.chars.toLocaleString()} characters`);
      setFallbackText(null);
      return;
    }
    setFallbackText(text);
    toast.error("Clipboard blocked — select and copy the text below");
  };

  if (!isOwner) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          refresh();
        }}
        className="fixed left-4 top-1/2 z-[85] -translate-y-1/2 rounded-full bg-amber-500 px-3 py-2 text-[11px] font-semibold text-amber-950 shadow-lg ring-2 ring-amber-300/50"
        title="Owner diagnostics"
        aria-label="Open diagnostics"
        data-testid="owner-diagnostics-launcher"
      >
        <span className="flex items-center gap-1.5">
          <Bug className="size-3.5" strokeWidth={2} />
          Diagnostics
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
          data-testid="runtime-diagnostics-modal"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Close diagnostics"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "relative flex max-h-[min(90vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/25 bg-background shadow-2xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-[14px] font-semibold text-foreground">Runtime diagnostics</p>
                <p className="text-[11px] text-muted-foreground">
                  Owner only · last {entries.length} events
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <IdentitySummaryStrip />

            <div className="flex gap-2 border-b border-border px-5 py-2">
              <button
                type="button"
                onClick={() => void copyBundle()}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-500/30"
                data-testid="copy-diagnostic-bundle"
              >
                <Copy className="size-3.5" />
                Copy diagnostic bundle
              </button>
              <button
                type="button"
                onClick={() => {
                  clearRuntimeDiagnostics();
                  refresh();
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="size-3.5" />
                Clear
              </button>
            </div>

            {fallbackText ? (
              <div className="border-b border-border px-5 py-3">
                <textarea
                  readOnly
                  className="h-28 w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-[10px]"
                  value={fallbackText}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[10.5px]">
              {entries.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No events yet.</p>
              ) : (
                entries.map((e, i) => (
                  <div
                    key={`${e.at}-${i}`}
                    className="mb-2 rounded-lg bg-surface/80 px-2.5 py-2 ring-1 ring-border/60"
                  >
                    <p className="font-semibold text-accent">{e.event}</p>
                    <p className="text-muted-foreground">{e.at}</p>
                    {e.detail ? (
                      <pre className="mt-1 whitespace-pre-wrap break-all text-foreground/80">
                        {JSON.stringify(e.detail)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
