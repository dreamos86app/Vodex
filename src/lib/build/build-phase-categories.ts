import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";
import type { BuildStepUiKind } from "@/lib/build/build-step-ui";

export type BuildPhaseCategory = {
  id: string;
  label: string;
  kind: BuildStepUiKind;
  chunkIds: string[];
  intro?: string;
};

export const BUILD_PHASE_CATEGORIES: BuildPhaseCategory[] = [
  {
    id: "foundation",
    label: "App foundation",
    kind: "planning",
    chunkIds: ["generate_app_shell", "generate_design_system"],
    intro: "Setting up layout, config, and design tokens.",
  },
  {
    id: "core_pages",
    label: "Core pages",
    kind: "generating",
    chunkIds: ["generate_home_page", "generate_dashboard_page"],
    intro: "Building home and dashboard screens.",
  },
  {
    id: "feature_routes",
    label: "Feature routes",
    kind: "generating",
    chunkIds: ["generate_route_pages_batch_1", "generate_route_pages_batch_2"],
    intro: "Adding domain-specific route pages.",
  },
  {
    id: "components_data",
    label: "Components & data",
    kind: "wiring",
    chunkIds: [
      "generate_components_batch_1",
      "generate_components_batch_2",
      "generate_mock_data",
      "generate_mobile_responsive_layer",
    ],
    intro: "Shared UI, mock data, and responsive layer.",
  },
  {
    id: "polish",
    label: "Final polish",
    kind: "wiring",
    chunkIds: ["generate_final_polish"],
    intro: "Navigation links, imports, and polish pass.",
  },
];

export function chunkIdForFileEvent(ev: AgentWorkflowEvent): string | null {
  const id = ev.metadata?.generation_chunk_id;
  return typeof id === "string" ? id : null;
}

export function categoryForChunkId(chunkId: string | null): BuildPhaseCategory | null {
  if (!chunkId) return null;
  return BUILD_PHASE_CATEGORIES.find((c) => c.chunkIds.includes(chunkId)) ?? null;
}

export function groupFileEventsByPhase(
  events: AgentWorkflowEvent[],
): Array<{ category: BuildPhaseCategory; events: AgentWorkflowEvent[] }> {
  const buckets = new Map<string, AgentWorkflowEvent[]>();
  const uncategorized: AgentWorkflowEvent[] = [];

  for (const ev of events) {
    const cat = categoryForChunkId(chunkIdForFileEvent(ev));
    if (!cat) {
      uncategorized.push(ev);
      continue;
    }
    const list = buckets.get(cat.id) ?? [];
    list.push(ev);
    buckets.set(cat.id, list);
  }

  const out: Array<{ category: BuildPhaseCategory; events: AgentWorkflowEvent[] }> = [];
  for (const cat of BUILD_PHASE_CATEGORIES) {
    const list = buckets.get(cat.id);
    if (list?.length) out.push({ category: cat, events: list });
  }
  if (uncategorized.length) {
    out.push({
      category: {
        id: "other",
        label: "Other files",
        kind: "generating",
        chunkIds: [],
      },
      events: uncategorized,
    });
  }
  return out;
}

export function isPhaseComplete(
  category: BuildPhaseCategory,
  completedChunkIds: Set<string>,
): boolean {
  if (!category.chunkIds.length) return false;
  return category.chunkIds.every((id) => completedChunkIds.has(id));
}
