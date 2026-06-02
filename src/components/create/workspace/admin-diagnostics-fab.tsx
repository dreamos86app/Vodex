"use client";

import * as React from "react";
import { Bug } from "lucide-react";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { BuildDiagnosticsCenter } from "@/components/create/workspace/build-diagnostics-center";
import type { BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";
import { useDraggablePosition } from "@/lib/ui/use-draggable-position";
import { cn } from "@/lib/utils";

/** Owner-only diagnostics — single center-left draggable launcher + centered modal. */
export function AdminDiagnosticsFab({
  projectId,
  buildJobId,
  slowBanner,
  diagnosticsOpen,
  onDiagnosticsOpenChange,
  diagnostics,
  onDiagnosticsLoaded,
  autoOpenOnFailure,
}: {
  projectId?: string | null;
  buildJobId?: string | null;
  slowBanner?: string | null;
  diagnosticsOpen?: boolean;
  onDiagnosticsOpenChange?: (open: boolean) => void;
  diagnostics?: BuildDiagnosticsPayload | null;
  onDiagnosticsLoaded?: (payload: BuildDiagnosticsPayload | null) => void;
  autoOpenOnFailure?: boolean;
}) {
  const email = useAuthStore((s) => s.user?.email);
  const allowed = isDreamosOwnerEmail(email);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [internalDiag, setInternalDiag] = React.useState<BuildDiagnosticsPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { pos, style, dragHandlers } = useDraggablePosition("vodex_owner_diagnostics_pos", {
    x: 20,
    y: typeof window !== "undefined" ? Math.round(window.innerHeight * 0.38) : 300,
  });

  const open = diagnosticsOpen ?? internalOpen;
  const setOpen = onDiagnosticsOpenChange ?? setInternalOpen;
  const diag = diagnostics ?? internalDiag;

  const fetchDiagnostics = React.useCallback(async (): Promise<BuildDiagnosticsPayload | null> => {
    if (!allowed || !projectId || !buildJobId) return null;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/build-jobs/${buildJobId}/diagnostics`,
        { credentials: "include", cache: "no-store" },
      );
      const body = (await res.json()) as { ok?: boolean; diagnostics?: BuildDiagnosticsPayload };
      if (body.ok && body.diagnostics) {
        setInternalDiag(body.diagnostics);
        onDiagnosticsLoaded?.(body.diagnostics);
        return body.diagnostics;
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [allowed, projectId, buildJobId, onDiagnosticsLoaded]);

  React.useEffect(() => {
    if (!autoOpenOnFailure || !allowed) return;
    setOpen(true);
    void fetchDiagnostics();
  }, [autoOpenOnFailure, allowed, fetchDiagnostics, setOpen]);

  React.useEffect(() => {
    if (!open || !allowed || !projectId || !buildJobId) return;
    if (diag) return;
    void fetchDiagnostics();
  }, [open, allowed, projectId, buildJobId, diag, fetchDiagnostics]);

  if (!allowed) return null;

  return (
    <>
      {slowBanner ? (
        <div
          className="fixed inset-x-0 top-20 z-[85] mx-auto flex max-w-md items-center justify-center px-4"
          data-testid="admin-slow-build-banner"
        >
          <div className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-[11px] text-amber-900 shadow-lg backdrop-blur dark:text-amber-100">
            {slowBanner}
          </div>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            void fetchDiagnostics();
          }}
          className={cn(
            "fixed z-[85] cursor-grab touch-none rounded-full bg-amber-500 px-3 py-2 text-[11px] font-semibold text-amber-950 shadow-lg ring-2 ring-amber-300/50 active:cursor-grabbing",
          )}
          style={style}
          title="Owner diagnostics (drag to reposition)"
          aria-label="Open diagnostics"
          data-testid="owner-diagnostics-launcher"
          {...dragHandlers}
        >
          <span className="flex items-center gap-1.5 pointer-events-none">
            <Bug className="size-3.5" strokeWidth={2} />
            Diagnostics
          </span>
        </button>
      ) : null}

      <BuildDiagnosticsCenter
        open={open}
        onClose={() => setOpen(false)}
        diagnostics={diag}
        launcherPos={pos}
        loading={loading}
        onFetchDiagnostics={fetchDiagnostics}
      />
    </>
  );
}
