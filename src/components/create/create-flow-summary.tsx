"use client";

import { cn } from "@/lib/utils";
import type { CreateFlowUiStep } from "@/lib/create/create-flow-state";
import { CREATE_FLOW_STEP_LABELS } from "@/lib/create/create-flow-state";
import { CREATE_TEMPLATES } from "@/components/create/create-template-picker";
import { STYLE_PRESETS } from "@/components/create/create-style-presets";

const BUILD_DEPTH_LABELS: Record<string, string> = {
  quick: "Quick",
  standard: "Standard",
  production: "Full polish",
};

const COST_LABELS: Record<string, string> = {
  quick: "Light",
  standard: "Standard",
  production: "Full",
};

export function CreateFlowSummary({
  uiStep,
  projectCreated,
  templateId,
  stylePresetId,
  buildTier,
  lifecycle,
  fileCount,
  costTier,
  className,
  compact,
}: {
  uiStep: CreateFlowUiStep;
  projectCreated: boolean;
  templateId: string | null;
  stylePresetId: string | null;
  buildTier: string;
  lifecycle: string;
  fileCount: number;
  costTier?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const templateLabel = CREATE_TEMPLATES.find((t) => t.id === templateId)?.label ?? "Not chosen";
  const styleLabel = STYLE_PRESETS.find((s) => s.id === stylePresetId)?.label ?? "Not chosen";

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Summary
      </p>
      <dl className="space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Step</dt>
          <dd className="font-medium text-right">{CREATE_FLOW_STEP_LABELS[uiStep]}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">App</dt>
          <dd className="font-medium">{projectCreated ? "Saved to Your Apps" : "Not created yet"}</dd>
        </div>
        {!compact && (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Starting point</dt>
              <dd className="font-medium text-right">{templateLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Visual style</dt>
              <dd className="font-medium">{styleLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Build depth</dt>
              <dd className="font-medium">{BUILD_DEPTH_LABELS[buildTier] ?? buildTier}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{lifecycle.replace(/_/g, " ")}</dd>
            </div>
            {fileCount > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Files ready</dt>
                <dd className="font-medium">{fileCount}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {costTier && (
        <div className="rounded-xl bg-surface/80 px-3 py-2 text-[12px] ring-1 ring-border">
          <p className="font-semibold text-foreground">Build depth</p>
          <p className="mt-0.5 text-muted-foreground">{costTier} — exact credits shown after each step</p>
        </div>
      )}
      <div className="rounded-xl bg-background/80 px-3 py-2.5 text-[11px] ring-1 ring-border">
        <p className="font-semibold text-foreground">What happens next</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>Questions never start a build.</li>
          <li>Your app appears in Your Apps right away.</li>
          <li>You approve the blueprint before we build.</li>
          <li>Progress reflects real backend status.</li>
        </ul>
      </div>
    </div>
  );
}

export function costTierFromBuildTier(tier: string): string {
  return COST_LABELS[tier] ?? "Standard";
}
