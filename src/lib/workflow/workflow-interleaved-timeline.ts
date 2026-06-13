import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";
import { sanitizeUserBuildChatText } from "@/lib/build/build-user-copy";

export type InterleavedWorkflowItem =
  | { kind: "narration"; text: string; key: string }
  | { kind: "file"; event: AgentWorkflowEvent };

function isHeartbeat(ev: AgentWorkflowEvent): boolean {
  return ev.metadata?.heartbeat === true;
}

function isFileEvent(ev: AgentWorkflowEvent): boolean {
  return ev.category === "file_created" || ev.category === "file_edited" || ev.category === "file_deleted";
}

export type InterleavedWorkflowDisplay = {
  /** Committed narration → file pairs (stable history). */
  committed: InterleavedWorkflowItem[];
  /** Latest planning line since the last file (shown once, below committed). */
  liveNarration: string | null;
  /** Terminal summary when build finished. */
  terminalNarration: string | null;
};

/**
 * Strict narration ↔ file alternation: buffer narrations until a file lands, then flush one line + file.
 * During active builds, section cards and purpose headers are omitted to reduce noise.
 */
export function buildInterleavedWorkflowDisplay(input: {
  merged: AgentWorkflowEvent[];
  working: boolean;
}): InterleavedWorkflowDisplay {
  const { merged, working } = input;
  const committed: InterleavedWorkflowItem[] = [];
  const seenCommittedNarration = new Set<string>();

  let pendingNarration: { text: string; key: string } | null = null;

  const sorted = [...merged].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const flushPendingNarration = () => {
    if (!pendingNarration || seenCommittedNarration.has(pendingNarration.text)) return;
    seenCommittedNarration.add(pendingNarration.text);
    committed.push({ kind: "narration", text: pendingNarration.text, key: pendingNarration.key });
    pendingNarration = null;
  };

  for (const ev of sorted) {
    if (ev.category === "assistant_message" && !isHeartbeat(ev)) {
      const text = sanitizeUserBuildChatText(ev.subtitle ?? ev.title);
      if (text) {
        if (pendingNarration && pendingNarration.text !== text) {
          flushPendingNarration();
        }
        pendingNarration = { text, key: `n-${ev.stableKey}` };
      }
      continue;
    }

    if (isFileEvent(ev) && ev.filePath) {
      flushPendingNarration();
      committed.push({ kind: "file", event: ev });
    }
  }

  let terminalNarration: string | null = null;
  if (!working) {
    const terminalFromEvents = [...merged]
      .reverse()
      .find(
        (e) =>
          e.category === "assistant_message" &&
          !isHeartbeat(e) &&
          /complete|saved|finished|continuing|preview|stopped|cancelled/i.test(
            `${e.title ?? ""} ${e.subtitle ?? ""}`,
          ),
      );
    if (terminalFromEvents) {
      terminalNarration = sanitizeUserBuildChatText(
        terminalFromEvents.subtitle ?? terminalFromEvents.title ?? "",
      );
    }
    if (pendingNarration) {
      flushPendingNarration();
    }
    pendingNarration = null;
  }

  return {
    committed,
    liveNarration: working ? pendingNarration?.text ?? null : null,
    terminalNarration,
  };
}

/** @deprecated Use buildInterleavedWorkflowDisplay */
export function buildInterleavedWorkflowItems(input: {
  merged: AgentWorkflowEvent[];
  working: boolean;
  fileEvents: AgentWorkflowEvent[];
}) {
  const display = buildInterleavedWorkflowDisplay(input);
  const items: InterleavedWorkflowItem[] = [...display.committed];
  if (display.liveNarration) {
    items.push({ kind: "narration", text: display.liveNarration, key: "live-narration" });
  }
  if (display.terminalNarration) {
    items.push({ kind: "narration", text: display.terminalNarration, key: "terminal-summary" });
  }
  return items;
}
