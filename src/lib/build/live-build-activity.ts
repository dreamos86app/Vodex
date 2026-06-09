import type { BuildTerminalPhase } from "@/lib/build/build-terminal-state-machine";
import { isMajorBuildStage } from "@/lib/build/build-terminal-state-machine";

/** Domain-specific active work lines — never passive "waiting for model". */
export function domainActiveWorkLines(prompt: string): string[] {
  const p = prompt.toLowerCase();
  const lines: string[] = [];
  if (/smart home|automation|device|iot|scene/i.test(p)) {
    lines.push(
      "Creating smart home mock devices…",
      "Writing automation scenes page…",
      "Building energy chart components…",
      "Adding room grouping UI…",
    );
  }
  if (/workout|fitness|gym|streak/i.test(p)) {
    lines.push(
      "Planning workout streak engine…",
      "Building PR tracker components…",
      "Designing progress photo gallery…",
    );
  }
  if (/dashboard|analytics/i.test(p)) {
    lines.push("Generating dashboard layout…", "Building analytics chart components…");
  }
  lines.push(
    "Checking navigation coverage…",
    "Wiring route links in AppShell…",
    "Parsing generated files…",
  );
  return lines;
}

export function activeWorkDuringChunk(
  chunk: { activeWork: string; label: string },
  tick: number,
  extra: string[] = [],
): string {
  const pool = [chunk.activeWork, ...extra];
  return pool[tick % pool.length] ?? chunk.activeWork;
}

export function formatChunkProgress(index: number, total: number, label: string): string {
  return `${index}/${total} ${label}`;
}

export function modelStageActivityMessages(prompt: string): string[] {
  const intro =
    "I'll turn this into a production app with these systems — shell, data, routes, components, then polish.";
  return [intro, ...domainActiveWorkLines(prompt)];
}

export function pickLiveActivityLine(messages: string[], elapsedMs: number): string {
  if (messages.length === 0) return "Generating next chunk…";
  const idx = Math.min(messages.length - 1, Math.floor(elapsedMs / 2200));
  return messages[idx]!;
}

export function continuationStatusLine(attempt: number, maxAttempts: number, reason?: string): string {
  const n = Math.min(attempt, maxAttempts);
  if (reason?.includes("quality")) return `Retry ${n}/${maxAttempts} · targeted rewrite for weak pages…`;
  if (reason?.includes("compact")) return `Retry ${n}/${maxAttempts} · smaller route batch…`;
  return `Retry ${n}/${maxAttempts} · next generation chunk…`;
}

/** @deprecated Use activeWorkDuringChunk — no passive model wait copy. */
export function formatWatchdogHeartbeat(input: {
  modelLabel?: string | null;
  elapsedSec: number;
  attempt?: number;
  maxAttempts?: number;
  waitingOn?: string;
  tick?: number;
}): string {
  const work = input.waitingOn?.trim();
  if (work && !/still waiting/i.test(work)) return work.endsWith("…") ? work : `${work}…`;
  return `Generating ${input.waitingOn ?? "next chunk"}…`;
}

export function formatCompactQualityLine(score: number, target: number, files: number): string {
  return `Validating ${files} files · quality ${score}/${target}…`;
}

export type BuildActivityPresentation = {
  mode: "card" | "compact";
  line: string;
  phase: BuildTerminalPhase;
  chunkProgress?: string;
};

export function deriveBuildActivityPresentation(input: {
  phase: BuildTerminalPhase;
  elapsedMs: number;
  userPrompt?: string;
  assistantMessage?: string;
  isHeartbeat?: boolean;
  attempt?: number;
  maxAttempts?: number;
  qualityScore?: number;
  qualityTarget?: number;
  fileCount?: number;
  modelLabel?: string | null;
  chunkProgress?: string;
  activeWork?: string;
}): BuildActivityPresentation {
  const messages = modelStageActivityMessages(input.userPrompt ?? "");
  const elapsedSec = Math.max(0, Math.floor(input.elapsedMs / 1000));

  if (input.chunkProgress) {
    return {
      mode: "compact",
      phase: input.phase,
      line: input.activeWork ?? pickLiveActivityLine(messages, input.elapsedMs),
      chunkProgress: input.chunkProgress,
    };
  }

  if (input.activeWork) {
    return {
      mode: "compact",
      phase: input.phase,
      line: input.activeWork,
    };
  }

  if (input.isHeartbeat) {
    const work = input.assistantMessage?.trim();
    return {
      mode: "compact",
      phase: input.phase,
      line: work && !/still waiting for/i.test(work)
        ? work
        : pickLiveActivityLine(messages, input.elapsedMs),
    };
  }

  if (
    input.phase === "continuation_running" &&
    input.attempt != null &&
    input.maxAttempts != null
  ) {
    return {
      mode: input.attempt <= 1 ? "card" : "compact",
      phase: input.phase,
      line: continuationStatusLine(input.attempt, input.maxAttempts, input.assistantMessage ?? undefined),
    };
  }

  if (
    input.qualityScore != null &&
    input.qualityTarget != null &&
    input.phase === "validating_quality"
  ) {
    return {
      mode: "compact",
      phase: input.phase,
      line: formatCompactQualityLine(input.qualityScore, input.qualityTarget, input.fileCount ?? 0),
    };
  }

  if (isMajorBuildStage(input.phase) && elapsedSec < 6) {
    return {
      mode: "card",
      phase: input.phase,
      line: pickLiveActivityLine(messages, input.elapsedMs),
    };
  }

  return {
    mode: "compact",
    phase: input.phase,
    line: pickLiveActivityLine(messages, input.elapsedMs),
  };
}
