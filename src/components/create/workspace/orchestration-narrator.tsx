"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_MARKER } from "@/lib/creation/orchestration";

// ─── Narration lines per phase role ──────────────────────────────────────────

const PHASE_NARRATION: Record<string, string[]> = {
  architect: [
    "Planning system architecture…",
    "Mapping component dependencies…",
    "Defining data flows and routes…",
    "Scoping technical decisions…",
  ],
  design: [
    "Establishing visual language…",
    "Defining color tokens and typography…",
    "Generating design system primitives…",
    "Building component patterns…",
  ],
  database: [
    "Modeling database relationships…",
    "Generating table schemas…",
    "Writing RLS policies…",
    "Optimizing indexes and queries…",
  ],
  backend: [
    "Building API route handlers…",
    "Wiring authentication flows…",
    "Setting up service integrations…",
    "Designing business logic…",
  ],
  security: [
    "Auditing auth boundaries…",
    "Enforcing row-level security…",
    "Hardening secret handling…",
    "Validating permission model…",
  ],
  frontend: [
    "Generating UI components…",
    "Building responsive layouts…",
    "Wiring state and interactions…",
    "Composing page structure…",
  ],
  motion: [
    "Choreographing entrance animations…",
    "Adding micro-interaction layers…",
    "Tuning transition curves…",
    "Polishing hover and focus states…",
  ],
  performance: [
    "Analyzing bundle footprint…",
    "Optimizing query patterns…",
    "Reviewing caching strategy…",
    "Profiling render paths…",
  ],
  ux: [
    "Refining copy and messaging…",
    "Improving accessibility…",
    "Filling empty states…",
    "Reviewing user journey…",
  ],
  refactor: [
    "Identifying dead code…",
    "Consolidating shared logic…",
    "Improving code structure…",
    "Cleaning unused dependencies…",
  ],
};

const INIT_NARRATION = [
  "Awakening orchestration engine…",
  "Parsing your request…",
  "Assembling specialist agents…",
  "Preparing generation pipeline…",
];

const COMPLETING_NARRATION = [
  "Finalizing output…",
  "Reviewing generated code…",
  "Checking for consistency…",
  "Wrapping orchestration…",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentPhaseRole(text: string): string | null {
  let lastRole: string | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(PHASE_MARKER);
    if (m) lastRole = m[1];
  }
  return lastRole;
}

function pickNarration(role: string | null, tick: number): string {
  const lines = role
    ? (PHASE_NARRATION[role] ?? INIT_NARRATION)
    : INIT_NARRATION;
  return lines[tick % lines.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  streamingText: string;
  isStreaming: boolean;
  isComplete?: boolean;
  className?: string;
}

export function OrchestrationNarrator({
  streamingText,
  isStreaming,
  isComplete,
  className,
}: Props) {
  const [tick, setTick] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  // Start tick when streaming starts, stop when done
  React.useEffect(() => {
    if (isStreaming) {
      setVisible(true);
      const id = setInterval(() => setTick((t) => t + 1), 2200);
      return () => clearInterval(id);
    } else {
      const t = setTimeout(() => setVisible(false), 800);
      return () => clearTimeout(t);
    }
  }, [isStreaming]);

  const role = getCurrentPhaseRole(streamingText);
  const lines = isComplete
    ? COMPLETING_NARRATION
    : role
      ? (PHASE_NARRATION[role] ?? INIT_NARRATION)
      : INIT_NARRATION;
  const line = lines[tick % lines.length];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5",
            className,
          )}
        >
          <Loader2
            className="size-3 shrink-0 animate-spin text-accent/60"
            strokeWidth={2}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={line}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="text-[11.5px] text-muted-foreground"
            >
              {line}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
