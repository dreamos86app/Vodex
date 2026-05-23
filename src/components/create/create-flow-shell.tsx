"use client";

import * as React from "react";
import { CreateIntentStep } from "@/components/create/create-intent-step";
import { CreateCreditEstimate } from "@/components/create/create-credit-estimate";
import { CreateProgressTimeline, type TimelineStage } from "@/components/create/create-progress-timeline";
import type { CreateIntentResult } from "@/lib/intent/create-intent-classifier";
import { cn } from "@/lib/utils";

export type CreateFlowShellProps = {
  children: React.ReactNode;
  intent?: CreateIntentResult | null;
  intentLoading?: boolean;
  credits?: number | null;
  creditsMax?: number | null;
  cheaperRecommended?: boolean;
  timeline?: TimelineStage[];
  workflowStep?: string;
  className?: string;
};

export function CreateFlowShell({
  children,
  intent,
  intentLoading,
  credits,
  creditsMax,
  cheaperRecommended,
  timeline,
  workflowStep,
  className,
}: CreateFlowShellProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="shrink-0 space-y-3 border-b border-border/60 px-4 py-3 sm:px-5">
        {(intent || intentLoading) && <CreateIntentStep result={intent ?? null} loading={intentLoading} />}
        <CreateCreditEstimate credits={credits} creditsMax={creditsMax} cheaperRecommended={cheaperRecommended} />
        {timeline && timeline.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {workflowStep ?? "Build progress"}
            </p>
            <CreateProgressTimeline stages={timeline} />
          </div>
        )}
        <details className="group text-[12px] text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground">
            What happens next
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>We classify your intent so questions do not trigger full builds.</li>
            <li>A real app record is created immediately and appears in Your Apps.</li>
            <li>You review the blueprint, then confirm build mode and credits.</li>
            <li>Progress follows real backend job stages — no fake waiting states.</li>
          </ul>
        </details>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
