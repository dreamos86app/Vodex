"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";
import {
  WORKFLOW_SECTIONS,
  workflowSectionStatus,
  groupFileEventsByPurpose,
  type WorkflowSectionId,
} from "@/lib/workflow/workflow-section-defs";

export type { WorkflowSectionId };
export { groupFileEventsByPurpose, WORKFLOW_SECTIONS };

export function WorkflowSectionCard({
  sectionId,
  events,
  working,
  className,
}: {
  sectionId: WorkflowSectionId;
  events: AgentWorkflowEvent[];
  working: boolean;
  className?: string;
}) {
  const section = WORKFLOW_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return null;
  const st = workflowSectionStatus(sectionId, events, working);
  const detail = events.filter(section.match).slice(-1)[0]?.subtitle ?? events.filter(section.match).slice(-1)[0]?.title;

  return (
    <div
      className={cn(
        "overflow-visible rounded-xl border px-3 py-2 transition",
        st === "active" && "border-amber-400/60 bg-amber-50/30 ring-2 ring-amber-400/40 dark:bg-amber-950/15",
        st === "done" && "border-emerald-500/35 bg-emerald-50/25 dark:bg-emerald-950/10",
        st === "pending" && "border-border/60 bg-surface/40",
        className,
      )}
      data-testid={`workflow-section-${sectionId}`}
      data-section-status={st}
    >
      <div className="flex items-center gap-2">
        {st === "done" ? (
          <Check className="size-3.5 shrink-0 text-emerald-600" />
        ) : st === "active" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-600" />
        ) : (
          <span className="size-3.5 shrink-0 rounded-full border border-border" />
        )}
        <span className="min-w-0 flex-1 text-[12px] font-semibold text-foreground">{section.label}</span>
      </div>
      {detail && st === "active" ? (
        <p className="mt-1 pl-5 text-[10.5px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

export function BuildWorkflowSections({
  events,
  working,
  ephemeralLine,
  className,
}: {
  events: AgentWorkflowEvent[];
  working: boolean;
  ephemeralLine?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  return (
    <section className={cn("mr-6 space-y-2 sm:mr-10", className)} data-testid="build-workflow-sections">
      {ephemeralLine ? (
        <p
          className="px-0.5 text-[11px] font-medium text-sky-600/90 dark:text-sky-300/80"
          data-testid="ephemeral-action-line"
        >
          {ephemeralLine}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {WORKFLOW_SECTIONS.map((section) => {
          const st = workflowSectionStatus(section.id, events, working);
          const detail = events.filter(section.match).slice(-1)[0]?.subtitle ?? events.filter(section.match).slice(-1)[0]?.title;
          return (
            <div
              key={section.id}
              className={cn(
                "overflow-visible rounded-xl border px-3 py-2 transition",
                st === "active" && "border-amber-400/60 bg-amber-50/30 ring-2 ring-amber-400/40 dark:bg-amber-950/15",
                st === "done" && "border-emerald-500/35 bg-emerald-50/25 dark:bg-emerald-950/10",
                st === "pending" && "border-border/60 bg-surface/40",
              )}
              data-testid={`workflow-section-${section.id}`}
              data-section-status={st}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setOpen((s) => ({ ...s, [section.id]: !s[section.id] }))}
              >
                {st === "done" ? (
                  <Check className="size-3.5 shrink-0 text-emerald-600" />
                ) : st === "active" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-600" />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-border" />
                )}
                <span className="min-w-0 flex-1 text-[12px] font-semibold text-foreground">{section.label}</span>
                <ChevronDown className={cn("size-3.5 text-muted-foreground transition", open[section.id] && "rotate-180")} />
              </button>
              {detail && (open[section.id] || st === "active") ? (
                <p className="mt-1 pl-5 text-[10.5px] text-muted-foreground">{detail}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
