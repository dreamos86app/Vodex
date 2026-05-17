"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Cpu,
  Layout,
  Database,
  Zap,
  Shield,
  Layers,
  Rocket,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_MARKER } from "@/lib/creation/orchestration";

export interface BuildPhaseEvent {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
}

// Extract phase titles from streaming text using the PHASE_MARKER regex
function extractPhases(text: string): string[] {
  const phases: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(PHASE_MARKER);
    if (m) {
      // m[1] = role key, m[2] = phase title
      const title = m[2]?.trim();
      if (title) phases.push(title);
    }
  }
  return phases;
}

// Map phase names to icons
function phaseIcon(label: string): React.ElementType {
  const l = label.toLowerCase();
  if (l.includes("plan") || l.includes("analys")) return Cpu;
  if (l.includes("architect") || l.includes("struct")) return Layers;
  if (l.includes("ui") || l.includes("layout") || l.includes("frontend") || l.includes("design")) return Layout;
  if (l.includes("data") || l.includes("schema") || l.includes("database") || l.includes("db")) return Database;
  if (l.includes("auth") || l.includes("security")) return Shield;
  if (l.includes("deploy") || l.includes("ship")) return Rocket;
  if (l.includes("backend") || l.includes("api")) return Zap;
  if (l.includes("fix") || l.includes("repair") || l.includes("optim")) return Wrench;
  return Zap;
}

interface BuildTimelineProps {
  streamingText: string;
  isStreaming: boolean;
  className?: string;
}

export function BuildTimeline({ streamingText, isStreaming, className }: BuildTimelineProps) {
  const completedPhases = React.useMemo(
    () => extractPhases(streamingText),
    [streamingText],
  );

  if (completedPhases.length === 0 && !isStreaming) return null;

  // Show "analyzing" step while waiting for first phase
  const phases: BuildPhaseEvent[] = completedPhases.map((label, i) => ({
    id: label,
    label,
    status: i < completedPhases.length - 1 || !isStreaming ? "done" : "active",
  }));

  if (isStreaming && phases.length === 0) {
    phases.push({ id: "init", label: "Analyzing request", status: "active" });
  } else if (isStreaming && phases.length > 0) {
    phases[phases.length - 1].status = "active";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex w-48 shrink-0 flex-col gap-1 overflow-hidden rounded-2xl bg-surface p-3 ring-1 ring-border",
        className,
      )}
    >
      <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
        Build Log
      </p>

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {phases.map((phase, i) => {
            const Icon = phaseIcon(phase.label);
            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className="flex items-start gap-2"
              >
                {/* Status icon */}
                <div className="relative mt-0.5 shrink-0">
                  {phase.status === "done" && (
                    <CheckCircle2 className="size-3.5 text-emerald-500" strokeWidth={2} />
                  )}
                  {phase.status === "active" && (
                    <Loader2 className="size-3.5 animate-spin text-accent" strokeWidth={2} />
                  )}
                  {phase.status === "pending" && (
                    <Circle className="size-3.5 text-muted-foreground/30" strokeWidth={1.5} />
                  )}
                  {/* Connector line */}
                  {i < phases.length - 1 && (
                    <div className="absolute left-1/2 top-4 h-[calc(100%+2px)] w-px -translate-x-1/2 bg-border" />
                  )}
                </div>

                <div className="min-w-0 pb-2">
                  <p className={cn(
                    "text-[11px] font-medium leading-snug",
                    phase.status === "done"
                      ? "text-foreground/70"
                      : phase.status === "active"
                        ? "text-foreground"
                        : "text-muted-foreground/40",
                  )}>
                    {phase.label}
                  </p>
                  {phase.status === "active" && (
                    <div className="mt-1 flex gap-0.5">
                      {[0, 0.15, 0.3].map((delay) => (
                        <motion.span
                          key={delay}
                          className="size-1 rounded-full bg-accent"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, delay, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
