"use client";

import * as React from "react";
import { Bug } from "lucide-react";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { BuildDiagnosticsCenter } from "@/components/create/workspace/build-diagnostics-center";
import type { BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";

/** Small reopen control only — primary UX is auto-centered BuildDiagnosticsCenter. */
export function AdminDiagnosticsFab({
  projectId,
  buildJobId,
  slowBanner,
  diagnosticsOpen,
  onDiagnosticsOpenChange,
  diagnostics,
}: {
  projectId?: string | null;
  buildJobId?: string | null;
  slowBanner?: string | null;
  diagnosticsOpen?: boolean;
  onDiagnosticsOpenChange?: (open: boolean) => void;
  diagnostics?: BuildDiagnosticsPayload | null;
}) {
  const email = useAuthStore((s) => s.user?.email);
  const allowed = isDreamosOwnerEmail(email);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [internalDiag, setInternalDiag] = React.useState<BuildDiagnosticsPayload | null>(null);

  const open = diagnosticsOpen ?? internalOpen;
  const setOpen = onDiagnosticsOpenChange ?? setInternalOpen;
  const diag = diagnostics ?? internalDiag;

  const load = React.useCallback(async () => {
    if (!allowed || !projectId || !buildJobId) return;
    const res = await fetch(
      `/api/projects/${projectId}/build-jobs/${buildJobId}/diagnostics`,
      { credentials: "include" },
    );
    const body = (await res.json()) as { ok?: boolean; diagnostics?: BuildDiagnosticsPayload };
    if (body.ok && body.diagnostics) setInternalDiag(body.diagnostics);
  }, [allowed, projectId, buildJobId]);

  if (!allowed) return null;

  if (!open) {
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
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            void load();
          }}
          className="fixed bottom-4 right-4 z-[75] inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-background/95 px-3 py-2 text-[11px] font-medium text-amber-600 shadow-lg backdrop-blur"
          data-testid="admin-diagnostics-reopen"
        >
          <Bug className="size-3.5" />
          Reopen diagnostics
        </button>
      </>
    );
  }

  return (
    <>
      <BuildDiagnosticsCenter open={open} onClose={() => setOpen(false)} diagnostics={diag} />
    </>
  );
}
