import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";
import { sanitizeUserBuildChatText } from "@/lib/build/build-user-copy";
import {
  WORKFLOW_SECTIONS,
  groupFileEventsByPurpose,
  workflowSectionStatus,
  type WorkflowSectionId,
} from "@/lib/workflow/workflow-section-defs";

export type InterleavedWorkflowItem =
  | { kind: "narration"; text: string; key: string }
  | { kind: "section"; sectionId: WorkflowSectionId; events: AgentWorkflowEvent[]; working: boolean }
  | { kind: "purpose_header"; label: string; key: string }
  | { kind: "file"; event: AgentWorkflowEvent };

function isHeartbeat(ev: AgentWorkflowEvent): boolean {
  return ev.metadata?.heartbeat === true;
}

function isFileEvent(ev: AgentWorkflowEvent): boolean {
  return ev.category === "file_created" || ev.category === "file_edited" || ev.category === "file_deleted";
}

function purposeLabelForPath(path: string): string | null {
  const groups = groupFileEventsByPurpose([{ filePath: path } as AgentWorkflowEvent]);
  return groups[0]?.label ?? null;
}

/** Chronological interleave: narration + section checkpoints + live files (no batch dump at top). */
export function buildInterleavedWorkflowItems(input: {
  merged: AgentWorkflowEvent[];
  working: boolean;
  fileEvents: AgentWorkflowEvent[];
}): InterleavedWorkflowItem[] {
  const { merged, working, fileEvents } = input;
  const items: InterleavedWorkflowItem[] = [];
  const seenNarration = new Set<string>();
  const emittedSections = new Set<WorkflowSectionId>();
  let lastPurpose: string | null = null;

  const sorted = [...merged].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const eventsSoFar: AgentWorkflowEvent[] = [];

  for (const ev of sorted) {
    eventsSoFar.push(ev);

    for (const section of WORKFLOW_SECTIONS) {
      if (emittedSections.has(section.id)) continue;
      if (!section.match(ev)) continue;
      const st = workflowSectionStatus(section.id, eventsSoFar, working);
      if (st === "pending") continue;
      emittedSections.add(section.id);
      items.push({
        kind: "section",
        sectionId: section.id,
        events: [...eventsSoFar],
        working,
      });
    }

    if (ev.category === "assistant_message" && !isHeartbeat(ev)) {
      const text = sanitizeUserBuildChatText(ev.subtitle ?? ev.title);
      if (text && !seenNarration.has(text)) {
        seenNarration.add(text);
        items.push({ kind: "narration", text, key: `n-${ev.stableKey}` });
      }
      continue;
    }

    if (isFileEvent(ev) && ev.filePath) {
      const label = purposeLabelForPath(ev.filePath);
      if (label && label !== lastPurpose) {
        lastPurpose = label;
        items.push({ kind: "purpose_header", label, key: `ph-${label}-${ev.stableKey}` });
      }
      items.push({ kind: "file", event: ev });
    }
  }

  if (!working && fileEvents.length > 0) {
    const lastNarration = [...items].reverse().find((i) => i.kind === "narration");
    const terminalFromEvents = [...merged]
      .reverse()
      .find(
        (e) =>
          e.category === "assistant_message" &&
          !isHeartbeat(e) &&
          /complete|saved|finished|continuing|preview/i.test(e.title ?? e.subtitle ?? ""),
      );
    if (terminalFromEvents) {
      const text = sanitizeUserBuildChatText(
        terminalFromEvents.subtitle ?? terminalFromEvents.title ?? "",
      );
      if (text && (!lastNarration || lastNarration.kind !== "narration" || lastNarration.text !== text)) {
        if (!seenNarration.has(text)) {
          items.push({ kind: "narration", text, key: "terminal-summary" });
        }
      }
    }
  }

  return items;
}
