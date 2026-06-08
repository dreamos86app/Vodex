/**
 * P1.3.16 — Detect deterministic generic SaaS scaffold (16-file dashboard/records/settings).
 */
import {
  filterRenderableBuildFiles,
  normalizeBuildFilePath,
  countRenderablePages,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import { countComponentFiles } from "@/lib/build/import-graph";

const GENERIC_COMPONENT_PATHS = [
  "components/MetricCard.tsx",
  "components/PageHeader.tsx",
  "components/EmptyState.tsx",
];

const GENERIC_ROUTE_PATHS = [
  "app/dashboard/page.tsx",
  "app/records/page.tsx",
  "app/settings/page.tsx",
];

const GENERIC_TABLE_RE =
  /<th[^>]*>\s*Item\s*<\/th>[\s\S]{0,120}<th[^>]*>\s*Status\s*<\/th>[\s\S]{0,120}<th[^>]*>\s*Updated\s*<\/th>/i;

const GENERIC_METRICS_RE = /metrics,\s*workflows,\s*and\s+(team\s+tools|daily\s+operations)/i;
const GENERIC_WELCOME_RE = /Open dashboard/i;

export type GenericScaffoldDetection = {
  isGeneric: boolean;
  confidence: number;
  reasons: string[];
  fileCount: number;
  routeCount: number;
  componentCount: number;
};

export function detectGenericScaffoldBuild(files: BuildFile[]): GenericScaffoldDetection {
  const renderable = filterRenderableBuildFiles(files);
  const paths = new Set(renderable.map((f) => normalizeBuildFilePath(f.path)));
  const ui = renderable.map((f) => f.content).join("\n");
  const reasons: string[] = [];
  let score = 0;

  const genericComponents = GENERIC_COMPONENT_PATHS.filter((p) => paths.has(p)).length;
  if (genericComponents >= 2) {
    score += 35;
    reasons.push("generic_components");
  }
  if (genericComponents === 3) score += 15;

  const genericRoutes = GENERIC_ROUTE_PATHS.filter((p) => paths.has(p)).length;
  if (genericRoutes >= 2) {
    score += 30;
    reasons.push("generic_routes_dashboard_records_settings");
  }

  if (paths.has("app/records/page.tsx") && paths.has("app/dashboard/page.tsx")) {
    score += 10;
  }

  if (GENERIC_TABLE_RE.test(ui)) {
    score += 25;
    reasons.push("generic_item_status_updated_table");
  }

  if (GENERIC_METRICS_RE.test(ui)) {
    score += 15;
    reasons.push("generic_metrics_workflows_copy");
  }

  if (GENERIC_WELCOME_RE.test(ui) && renderable.length <= 22) {
    score += 10;
    reasons.push("welcome_open_dashboard_pattern");
  }

  const fileCount = renderable.length;
  if (fileCount >= 10 && fileCount <= 22) score += 15;
  if (fileCount >= 10 && fileCount <= 18 && genericComponents >= 2 && genericRoutes >= 2) {
    score += 20;
    reasons.push("sixteen_file_scaffold_shape");
  }

  const routeCount = countRenderablePages(renderable);
  const componentCount = countComponentFiles(renderable);
  if (fileCount <= 22 && routeCount <= 6 && componentCount <= 6 && genericComponents >= 2) {
    score += 15;
    reasons.push("thin_generic_tree");
  }

  const isGeneric = score >= 55;

  return {
    isGeneric,
    confidence: Math.min(100, score),
    reasons: [...new Set(reasons)],
    fileCount,
    routeCount,
    componentCount,
  };
}

export function genericScaffoldFailureCode(detection: GenericScaffoldDetection): string {
  return `generic_scaffold_detected:${detection.reasons.slice(0, 4).join(",") || "pattern_match"}`;
}
