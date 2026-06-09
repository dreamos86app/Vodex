"use client";

import * as React from "react";
import { ChevronDown, FilePlus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";
import {
  BUILD_PHASE_CATEGORIES,
  groupFileEventsByPhase,
  isPhaseComplete,
  type BuildPhaseCategory,
} from "@/lib/build/build-phase-categories";
import { BUILD_STEP_RING_CLASS, BUILD_STEP_ACCENT_CLASS } from "@/lib/build/build-step-ui";

export function BuildPhasedFilePanel({
  fileEvents,
  completedChunkIds,
  renderFileCard,
  working,
  className,
}: {
  fileEvents: AgentWorkflowEvent[];
  completedChunkIds: Set<string>;
  renderFileCard: (event: AgentWorkflowEvent) => React.ReactNode;
  working: boolean;
  className?: string;
}) {
  const groups = React.useMemo(() => groupFileEventsByPhase(fileEvents), [fileEvents]);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const { category } of groups) {
        const done = isPhaseComplete(category, completedChunkIds);
        if (done && next[category.id] === undefined) {
          next[category.id] = false;
        } else if (!done) {
          next[category.id] = true;
        }
      }
      return next;
    });
  }, [groups, completedChunkIds]);

  if (fileEvents.length === 0 && !working) return null;

  return (
    <section
      className={cn(
        "mr-6 space-y-2 sm:mr-10",
        working && "sticky top-0 z-[1] rounded-2xl bg-background/90 pb-2 pt-0.5 backdrop-blur-sm",
        className,
      )}
      data-testid="build-phased-file-panel"
    >
      <div className="flex items-center gap-2 px-0.5">
        <FilePlus className="size-3.5 text-sky-600/90" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90">
          Build phases
        </span>
      </div>

      {fileEvents.length === 0 ? (
        <p className="px-0.5 text-[11px] text-muted-foreground">Waiting for first file…</p>
      ) : (
        <div className="space-y-2">
          {groups.map(({ category, events }) => (
            <PhaseSection
              key={category.id}
              category={category}
              events={events}
              open={openSections[category.id] !== false}
              done={isPhaseComplete(category, completedChunkIds)}
              onToggle={() =>
                setOpenSections((s) => ({ ...s, [category.id]: !s[category.id] }))
              }
              renderFileCard={renderFileCard}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PhaseSection({
  category,
  events,
  open,
  done,
  onToggle,
  renderFileCard,
}: {
  category: BuildPhaseCategory;
  events: AgentWorkflowEvent[];
  open: boolean;
  done: boolean;
  onToggle: () => void;
  renderFileCard: (event: AgentWorkflowEvent) => React.ReactNode;
}) {
  const meta = BUILD_PHASE_CATEGORIES.find((c) => c.id === category.id) ?? category;
  const ring = BUILD_STEP_RING_CLASS[meta.kind];
  const accent = BUILD_STEP_ACCENT_CLASS[meta.kind];

  return (
    <div
      className={cn("rounded-2xl px-2 py-2", ring, done && "opacity-90")}
      data-testid={`build-phase-${category.id}`}
      data-phase-done={done ? "true" : "false"}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronDown
          className={cn("size-3.5 shrink-0 transition", accent, !open && "-rotate-90")}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-bold uppercase tracking-wide", accent)}>
            {category.label}
            {done ? " · done" : ""}
          </p>
          {meta.intro && !done ? (
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">{meta.intro}</p>
          ) : null}
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {events.length} file{events.length === 1 ? "" : "s"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-1.5 overflow-hidden"
          >
            {events.map((ev) => (
              <li key={ev.stableKey}>{renderFileCard(ev)}</li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
