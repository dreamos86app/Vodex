import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";

export const EPHEMERAL_BUILD_STEPS: readonly { title: string; stableKey: string; ms: number }[] = [
  { title: "I am now going to work on the app structure and data model.", stableKey: "ephemeral:screens", ms: 700 },
  { title: "I am now going to work on the main layout and navigation.", stableKey: "ephemeral:layout", ms: 800 },
  { title: "I am now going to work on the core screens and components.", stableKey: "ephemeral:sections", ms: 900 },
  { title: "I am now going to work on preview readiness and polish.", stableKey: "ephemeral:preview", ms: 1000 },
] as const;

export function buildWorkOpenerFromPrompt(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const snippet =
    trimmed.length > 72 ? `${trimmed.slice(0, 72).trim()}…` : trimmed || "your app";
  return `I am now going to work on ${snippet}`;
}

export function buildEphemeralWorkflowEvents(
  startedAtMs: number,
  nowMs: number,
  openerText?: string,
  userPrompt?: string,
): AgentWorkflowEvent[] {
  const resolvedOpener =
    openerText ??
    (userPrompt?.trim() ? buildWorkOpenerFromPrompt(userPrompt) : undefined);
  const elapsed = nowMs - startedAtMs;
  const events: AgentWorkflowEvent[] = [];
  const at = new Date(nowMs).toISOString();

  if (resolvedOpener) {
    events.push({
      id: `ephemeral-opener-${startedAtMs}`,
      category: "assistant_message",
      title: resolvedOpener,
      status: "done",
      at,
      stableKey: "ephemeral:opener",
      metadata: { ephemeral: true },
    });
  }

  let cumulative = 0;
  for (const step of EPHEMERAL_BUILD_STEPS) {
    cumulative += step.ms;
    if (elapsed < cumulative - 200) break;
    events.push({
      id: `ephemeral-${step.stableKey}`,
      category: "task_started",
      title: step.title,
      status: elapsed >= cumulative ? "done" : "active",
      at,
      stableKey: step.stableKey,
      metadata: { ephemeral: true },
    });
  }

  const last = events[events.length - 1];
  const tailLabel =
    elapsed < 4000
      ? "Connecting to build"
      : elapsed < 12000
        ? "Still working on your app"
        : "Continuing — mapping files and preview";
  if (!last || last.status === "done" || last.category === "assistant_message") {
    events.push({
      id: `ephemeral-wait-${startedAtMs}-${Math.floor(elapsed / 2000)}`,
      category: "task_started",
      title: tailLabel,
      status: "active",
      at,
      stableKey: "ephemeral:wait",
      metadata: { ephemeral: true },
    });
  } else if (last.status === "active") {
    events[events.length - 1] = { ...last, title: tailLabel };
  }

  return events;
}

/** Merge server timeline over ephemeral rows without duplicate titles. */
export function mergeEphemeralWithServerEvents(
  ephemeral: AgentWorkflowEvent[],
  server: AgentWorkflowEvent[],
): AgentWorkflowEvent[] {
  if (server.length === 0) return ephemeral;
  const serverTitles = new Set(server.map((e) => e.title.toLowerCase()));
  const keptEphemeral = ephemeral.filter(
    (e) =>
      e.category === "assistant_message" ||
      e.stableKey === "ephemeral:wait" ||
      !serverTitles.has(e.title.toLowerCase()),
  );
  const messages = keptEphemeral.filter((e) => e.category === "assistant_message");
  const waitTail = keptEphemeral.find((e) => e.stableKey === "ephemeral:wait" && e.status === "active");
  return waitTail ? [...messages, ...server, waitTail] : [...messages, ...server];
}
