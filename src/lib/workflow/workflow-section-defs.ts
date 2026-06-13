import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";

export type WorkflowSectionId =
  | "product_plan"
  | "routes"
  | "data_model"
  | "components"
  | "pages"
  | "quality"
  | "preview";

export const WORKFLOW_SECTIONS: Array<{
  id: WorkflowSectionId;
  label: string;
  match: (ev: AgentWorkflowEvent) => boolean;
}> = [
  { id: "product_plan", label: "Product plan", match: (e) => /plan|understanding|archetype|brief/i.test(e.title) },
  { id: "routes", label: "Routes", match: (e) => /route|navigation|screen/i.test(e.title) },
  { id: "data_model", label: "Data model", match: (e) => /schema|mock data|data model/i.test(e.title) },
  { id: "components", label: "Components", match: (e) => /component/i.test(e.title) || /components\//i.test(e.filePath ?? "") },
  { id: "pages", label: "Pages", match: (e) => /page\.tsx|writing|created app\//i.test(`${e.filePath ?? ""} ${e.title}`) },
  { id: "quality", label: "Quality checks", match: (e) => /validat|checking|quality|interface/i.test(e.title) },
  { id: "preview", label: "Preview", match: (e) => /preview/i.test(e.title) },
];

export function workflowSectionStatus(
  id: WorkflowSectionId,
  events: AgentWorkflowEvent[],
  working: boolean,
): "pending" | "active" | "done" {
  const section = WORKFLOW_SECTIONS.find((s) => s.id === id)!;
  const matched = events.filter(section.match);
  if (matched.some((e) => e.status === "active")) return working ? "active" : "done";
  if (matched.some((e) => e.status === "done")) return "done";
  if (working && id === "product_plan" && events.length > 0) return "active";
  return "pending";
}

export function groupFileEventsByPurpose(events: AgentWorkflowEvent[]): Array<{
  id: string;
  label: string;
  events: AgentWorkflowEvent[];
}> {
  const buckets: Record<string, AgentWorkflowEvent[]> = {
    shell: [],
    pages: [],
    components: [],
    data: [],
    styles: [],
    config: [],
  };
  for (const ev of events) {
    const p = (ev.filePath ?? "").replace(/\\/g, "/").toLowerCase();
    if (!p) continue;
    if (/package\.json|tsconfig|capacitor|next\.config/.test(p)) buckets.config.push(ev);
    else if (/globals\.css|\.css$|tailwind/.test(p)) buckets.styles.push(ev);
    else if (/mock-data|lib\/.*data|schema/.test(p)) buckets.data.push(ev);
    else if (/components\//.test(p)) buckets.components.push(ev);
    else if (/app\/.*page\.(tsx|jsx)/.test(p) || p === "app/page.tsx") buckets.pages.push(ev);
    else buckets.shell.push(ev);
  }
  return [
    { id: "shell", label: "App shell", events: buckets.shell },
    { id: "pages", label: "Pages", events: buckets.pages },
    { id: "components", label: "Components", events: buckets.components },
    { id: "data", label: "Data", events: buckets.data },
    { id: "styles", label: "Styles", events: buckets.styles },
    { id: "config", label: "Config", events: buckets.config },
  ].filter((g) => g.events.length > 0);
}
