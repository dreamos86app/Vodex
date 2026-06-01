"use client";

import * as React from "react";
import { Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";
import { buildCopyFixPrompt } from "@/lib/build/build-diagnostics";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";

export function BuildDiagnosticsCenter({
  open,
  onClose,
  diagnostics,
  className,
}: {
  open: boolean;
  onClose: () => void;
  diagnostics: BuildDiagnosticsPayload | null;
  className?: string;
}) {
  const email = useAuthStore((s) => s.user?.email);
  const allowed = isDreamosOwnerEmail(email);

  if (!open || !allowed || !diagnostics) return null;

  const copyPrompt = async () => {
    const text = buildCopyFixPrompt(diagnostics);
    await navigator.clipboard.writeText(text);
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-[80] flex w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl",
        className,
      )}
      data-testid="build-diagnostics-center"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Build Diagnostics Center</h2>
          <p className="text-[10px] text-muted-foreground">Admin-only technical view</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1.5 text-[10px] font-medium text-accent"
            data-testid="copy-full-fix-prompt"
          >
            <Copy className="size-3" />
            Copy full fix prompt
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
        <Section title="IDs">
          build_job_id: {diagnostics.build_job_id}
          {"\n"}project_id: {diagnostics.project_id}
          {"\n"}failure_code: {diagnostics.failure_code ?? "—"}
        </Section>
        <Section title="Prompt">{diagnostics.user_prompt ?? "—"}</Section>
        <Section title="Mode / model">
          mode_at_submit: {diagnostics.mode_at_submit ?? "—"}
          {"\n"}model: {diagnostics.model_used ?? "—"}
        </Section>
        <Section title="Failure">{diagnostics.failure_message ?? "—"}</Section>
        <Section title="Stack">{diagnostics.stack_trace ?? "—"}</Section>
        <Section title="Preview URL">{diagnostics.preview_url ?? "—"}</Section>
        <Section title="package.json">{diagnostics.package_json_excerpt ?? "—"}</Section>
        <Section title="app/page.tsx">{diagnostics.root_page_excerpt ?? "—"}</Section>
        <Section title="Files">{(diagnostics.generated_files ?? []).join("\n") || "—"}</Section>
        <Section title="Slow steps">
          {(diagnostics.slow_steps ?? [])
            .map((s) => `${s.stepId}: ${Math.round(s.durationMs / 1000)}s`)
            .join("\n") || "—"}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">{title}</p>
      <pre className="whitespace-pre-wrap break-all rounded-lg bg-muted/40 p-2">{children}</pre>
    </div>
  );
}
