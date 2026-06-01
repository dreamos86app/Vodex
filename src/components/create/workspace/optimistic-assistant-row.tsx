"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { DreamOSMessageShell } from "@/components/create/workspace/dreamos-message-shell";
import { AnimatedDotsText } from "@/components/ui/animated-dots";

const DISCUSS_PHASES = ["Thinking", "Considering your question", "Drafting a response"];

const BUILD_PHASES = [
  "Preparing your build",
  "Analyzing your request",
  "Designing the app structure",
  "Writing the first version",
  "Validating generated files",
];

const EDIT_PHASES = ["Applying your edit", "Updating project files", "Checking changes"];

type TaskMode = "build" | "discuss" | "edit" | "design";

type OptimisticAssistantRowProps = {
  /** Mode locked at submit — must not follow tab changes mid-run. */
  mode: TaskMode;
};

export function OptimisticAssistantRow({ mode }: OptimisticAssistantRowProps) {
  const [phaseIndex, setPhaseIndex] = React.useState(0);

  const phases =
    mode === "discuss" ? DISCUSS_PHASES : mode === "edit" ? EDIT_PHASES : BUILD_PHASES;

  React.useEffect(() => {
    setPhaseIndex(0);
    const tick = setInterval(() => {
      setPhaseIndex((i) => Math.min(i + 1, phases.length - 1));
    }, 2400);
    return () => clearInterval(tick);
  }, [mode, phases.length]);

  const base = phases[phaseIndex] ?? phases[0] ?? "Working";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group">
      <DreamOSMessageShell
        mode={mode === "discuss" ? "discuss" : "build"}
        status="thinking"
        costState="pending"
      >
        <p className="text-[13px] leading-relaxed text-foreground">
          <AnimatedDotsText base={base} />
        </p>
      </DreamOSMessageShell>
    </motion.div>
  );
}
