import type { BuildTerminalPhase } from "@/lib/build/build-terminal-state-machine";

const PARSING_HEARTBEATS = [
  "Checking TypeScript sources and imports…",
  "Validating routes and page structure…",
  "Scanning components for placeholders…",
  "Verifying navigation links…",
  "Preparing preview bundle…",
  "Still validating — almost ready for preview…",
];

const GENERATING_HEARTBEATS = [
  "Writing app screens and components…",
  "Generating layout and shared UI…",
  "Adding mock data and styles…",
  "Continuing file generation…",
];

const PLANNING_HEARTBEATS = [
  "Mapping screens, data, and flows…",
  "Designing routes and navigation…",
  "Planning components and pages…",
];

export function buildStepHeartbeatLine(input: {
  phase: BuildTerminalPhase;
  working: boolean;
  elapsedMs: number;
  chunkProgress?: string;
  ephemeralLine?: string;
}): string | undefined {
  if (!input.working) return undefined;
  if (input.chunkProgress?.trim()) return input.chunkProgress.trim();
  if (input.ephemeralLine?.trim()) return input.ephemeralLine.trim();

  const poolMs =
    input.phase === "extracting_files" || input.phase === "validating_quality" ? 2800 : 4500;
  const tick = Math.floor(input.elapsedMs / poolMs);
  let pool = GENERATING_HEARTBEATS;
  if (input.phase === "planning" || input.phase === "pending") pool = PLANNING_HEARTBEATS;
  if (input.phase === "extracting_files" || input.phase === "validating_quality") {
    pool = PARSING_HEARTBEATS;
  }
  return pool[tick % pool.length];
}
