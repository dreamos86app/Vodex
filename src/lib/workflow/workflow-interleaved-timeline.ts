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

function isCollapsedFileBatch(ev: AgentWorkflowEvent): boolean {
  return Boolean(
    ev.metadata?.collapsed_file_summary === true ||
      (Array.isArray(ev.metadata?.file_group) && (ev.metadata.file_group as unknown[]).length > 0),
  );
}

export type InterleavedWorkflowDisplay = {
  /** Stable narration → file pairs (one narration max before each file). */
  committed: InterleavedWorkflowItem[];
  /** Single in-flight planning line (never stacked with committed narrations). */
  liveNarration: string | null;
  /** Terminal summary when build finished. */
  terminalNarration: string | null;
};

/**
 * Strict one-by-one: at most one live narration; narrations commit only when the next file lands.
 * Orphan narrations are dropped on terminal — never flushed as a wall of text.
 */
export function buildInterleavedWorkflowDisplay(input: {
  merged: AgentWorkflowEvent[];
  working: boolean;
}): InterleavedWorkflowDisplay {
  const { merged, working } = input;
  const committed: InterleavedWorkflowItem[] = [];
  const seenCommittedNarration = new Set<string>();
  const seenFilePaths = new Set<string>();

  let pendingNarration: { text: string; key: string } | null = null;

  const sorted = [...merged].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  for (const ev of sorted) {
    if (ev.category === "assistant_message" && !isHeartbeat(ev)) {
      const text = sanitizeUserBuildChatText(ev.subtitle ?? ev.title);
      if (!text || seenCommittedNarration.has(text)) continue;
      if (pendingNarration !== null && pendingNarration.text === text) continue;
      pendingNarration = { text, key: `n-${ev.stableKey}` };
      continue;
    }

    if (isFileEvent(ev) && ev.filePath && !isCollapsedFileBatch(ev)) {
      const pathKey = ev.filePath.replace(/\\/g, "/").toLowerCase();
      if (seenFilePaths.has(pathKey)) continue;
      seenFilePaths.add(pathKey);

      if (pendingNarration) {
        seenCommittedNarration.add(pendingNarration.text);
        committed.push({ kind: "narration", text: pendingNarration.text, key: pendingNarration.key });
        pendingNarration = null;
      }
      committed.push({ kind: "file", event: ev });
    }
  }

  let terminalNarration: string | null = null;
  if (!working) {
    const terminalFromEvents = [...merged]
      .reverse()
      .find((e) => {
        if (e.category !== "assistant_message" || isHeartbeat(e)) return false;
        const body = `${e.title ?? ""} ${e.subtitle ?? ""}`;
        return (
          e.metadata?.build_final_summary === true ||
          /^Build (complete|saved|blocked|paused)/i.test(body) ||
          /^(Preview live|Build needs another)/i.test(body.trim())
        );
      });
    if (terminalFromEvents) {
      terminalNarration = sanitizeUserBuildChatText(
        terminalFromEvents.subtitle ?? terminalFromEvents.title ?? "",
      );
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
