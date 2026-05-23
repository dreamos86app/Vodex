/** User-facing build timeline labels — no internal model names. */
export const PREMIUM_BUILD_STAGES = [
  { id: "understand", label: "Understanding your idea", icon: "sparkles" },
  { id: "blueprint", label: "Designing the app structure", icon: "layers" },
  { id: "database", label: "Preparing the database", icon: "database" },
  { id: "interface", label: "Building the interface", icon: "layout" },
  { id: "logic", label: "Connecting logic", icon: "zap" },
  { id: "errors", label: "Checking for errors", icon: "shield" },
  { id: "polish", label: "Polishing the experience", icon: "wand" },
  { id: "preview", label: "Preparing preview", icon: "monitor" },
  { id: "deploy", label: "Ready to deploy", icon: "rocket" },
] as const;

export function mapPipelineEventToStage(
  eventType: string,
): (typeof PREMIUM_BUILD_STAGES)[number] | null {
  const t = eventType.toLowerCase();
  if (t.includes("classified") || t.includes("thinking") || t.includes("intake")) {
    return PREMIUM_BUILD_STAGES[0];
  }
  if (t.includes("plan")) return PREMIUM_BUILD_STAGES[1];
  if (t.includes("schema")) return PREMIUM_BUILD_STAGES[2];
  if (t.includes("design") || t.includes("frontend") || t.includes("writing")) {
    return PREMIUM_BUILD_STAGES[3];
  }
  if (t.includes("backend") || t.includes("integration")) return PREMIUM_BUILD_STAGES[4];
  if (t.includes("validat") || t.includes("compil") || t.includes("repair")) {
    return PREMIUM_BUILD_STAGES[5];
  }
  if (t.includes("finaliz") || t.includes("saving")) return PREMIUM_BUILD_STAGES[6];
  if (t.includes("preview")) return PREMIUM_BUILD_STAGES[7];
  if (t.includes("done")) return PREMIUM_BUILD_STAGES[8];
  return null;
}
