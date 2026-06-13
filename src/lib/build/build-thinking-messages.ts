import type { AppArchetypeId } from "@/lib/build/app-archetype-classifier";

/** Deterministic Base44-style status copy — no extra model call. */
export function thinkingForArchetypeClassified(label: string): string {
  return `I'll build this as a ${label}. Let me map the screens, flows, and data model first.`;
}

export function thinkingForDesignBrief(routes: string[]): string {
  const preview = routes.slice(0, 4).join(", ");
  return `Routes are set (${preview}${routes.length > 4 ? "…" : ""}) — now I'll generate the UI and components.`;
}

export function thinkingForFrontendStart(appName: string): string {
  return `Now I'm writing the core screens and components for ${appName}.`;
}

export function thinkingForFilePath(path: string): string {
  const base = path.split("/").pop() ?? path;
  if (/page\.(tsx|jsx)$/i.test(path)) {
    const segment = path.replace(/\/page\.(tsx|jsx)$/i, "").replace(/^app\/?/, "") || "home";
    return `Working on the ${segment === "" ? "home" : segment} page…`;
  }
  if (/layout\.(tsx|jsx)$/i.test(path)) return "Setting up the app shell and navigation…";
  if (/globals\.css$/i.test(path)) return "Applying layout styles and typography…";
  if (/mock-data|data/i.test(path)) return "Adding realistic sample data for the preview…";
  if (/components\//i.test(path)) return `Building ${base.replace(/\.(tsx|jsx)$/, "")}…`;
  return `Now working on ${base}…`;
}

export function thinkingForFrontendRetry(): string {
  return "First pass was thin — expanding with more routes, components, and app-specific UI.";
}

export function thinkingForContinuation(currentFiles: number, targetFiles: number): string {
  return `Continuing generation: adding remaining pages (${currentFiles}/${targetFiles} files)…`;
}

export function thinkingForRouteConnectivity(verified: number, total: number): string {
  return `Wiring navigation — ${verified}/${total} routes linked and reachable.`;
}

export function thinkingForFrontendFailed(): string {
  return "First pass was incomplete — I'll add the missing routes and components without replacing what's already there.";
}

export function thinkingForQualityCheck(): string {
  return "Let me check the interface quality and polish anything that looks thin.";
}

export function thinkingForIconStatus(
  status: string,
  appName: string,
  _error?: string | null,
  _mode?: string | null,
): string | null {
  if (status === "generated") return `Designed an app-specific icon for ${appName}.`;
  return null;
}

export function thinkingForArchetypeRoutes(id: AppArchetypeId): string {
  const hints: Partial<Record<AppArchetypeId, string>> = {
    booking:
      "Next I'll wire turnover tasks, cleaner scheduling, guest message templates, and a revenue calendar.",
    finance_tracker: "Next I'll wire dashboards, ledgers, and summary cards with realistic sample data.",
    crm: "Next I'll wire contacts, pipeline stages, and activity views.",
    marketplace: "Next I'll wire listings, vendor cards, and order summaries.",
  };
  return hints[id] ?? "Next I'll wire the main screens with realistic sample data and polished layout.";
}
