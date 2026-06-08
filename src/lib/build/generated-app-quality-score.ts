/**
 * P1.3.14 — Composite generated-app quality score (0–100).
 */
import { checkGeneratedUiQuality } from "@/lib/build/generated-ui-quality-checker";
import { checkAppSpecificLanguage } from "@/lib/build/app-specific-language-check";
import {
  checkRouteConnectivity,
  routeConnectivityScore,
  countAppRoutes,
} from "@/lib/build/route-connectivity-check";
import { countComponentFiles } from "@/lib/build/import-graph";
import {
  filterRenderableBuildFiles,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import type { FullAppGenerationBudget } from "@/lib/build/full-app-generation-plan";

export type GeneratedAppQualityReport = {
  score: number;
  passes: boolean;
  tier: FullAppGenerationBudget["tier"];
  minRequiredScore: number;
  dimensions: {
    routeCoverage: number;
    componentRichness: number;
    uiDensity: number;
    visualPolish: number;
    appSpecificLanguage: number;
    mockData: number;
    navigationConnectivity: number;
    responsiveness: number;
    previewUsefulness: number;
  };
  counts: {
    files: number;
    routes: number;
    components: number;
  };
  failures: string[];
  routeConnectivity: ReturnType<typeof checkRouteConnectivity>;
  needsRepair: boolean;
  needsContinuation: boolean;
};

function scoreMockData(files: BuildFile[]): number {
  const dataFile = files.find((f) => /mock-data|fixtures|sample-data/i.test(f.path));
  const ui = files
    .filter((f) => /\.(tsx|jsx)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");
  let score = 0;
  if (dataFile) score += 40;
  const entitySignals = (ui.match(/\b(id|name|status|date|amount|email|phone|title)\b/gi) ?? []).length;
  score += Math.min(40, entitySignals);
  const arrayLiterals = (ui.match(/\[\s*\{[\s\S]{20,}/g) ?? []).length;
  score += Math.min(20, arrayLiterals * 8);
  return Math.min(100, score);
}

function scoreResponsiveness(files: BuildFile[]): number {
  const ui = files
    .filter((f) => /\.(tsx|jsx|css)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");
  let score = 30;
  if (/sm:|md:|lg:/.test(ui)) score += 35;
  if (/grid-cols-|flex-col|hidden sm:|md:flex/.test(ui)) score += 25;
  if (/viewport|safe-area|overflow-x/.test(ui)) score += 10;
  return Math.min(100, score);
}

export function scoreGeneratedAppQuality(input: {
  files: BuildFile[];
  budget: FullAppGenerationBudget;
  userPrompt?: string;
  appType?: string | null;
  routeMap?: string[] | null;
}): GeneratedAppQualityReport {
  const renderable = filterRenderableBuildFiles(input.files);
  const uiQuality = checkGeneratedUiQuality({
    files: renderable,
    appType: input.appType,
    routeMap: input.routeMap,
  });
  const language = checkAppSpecificLanguage({
    files: renderable,
    userPrompt: input.userPrompt,
  });
  const routeConnectivity = checkRouteConnectivity(renderable);

  const files = renderable.length;
  const routes = countAppRoutes(renderable);
  const components = countComponentFiles(renderable);

  const failures: string[] = [];
  if (files < input.budget.minFiles) failures.push(`files_${files}_lt_${input.budget.minFiles}`);
  if (routes < input.budget.minRoutes) failures.push(`routes_${routes}_lt_${input.budget.minRoutes}`);
  if (components < input.budget.minComponents) {
    failures.push(`components_${components}_lt_${input.budget.minComponents}`);
  }
  if (!language.passes) failures.push("generic_shell_language");
  if (!routeConnectivity.passes) failures.push(...routeConnectivity.failures);

  const routeCoverage = Math.min(
    100,
    Math.round((routes / input.budget.minRoutes) * 85 + (files >= input.budget.minFiles ? 15 : 0)),
  );
  const componentRichness = Math.min(
    100,
    Math.round((components / input.budget.minComponents) * 100),
  );
  const uiDensity = Math.min(100, uiQuality.uiRichnessScore);
  const visualPolish = Math.min(100, uiQuality.score);
  const appSpecificLanguage = Math.max(0, 100 - language.scorePenalty);
  const mockData = scoreMockData(renderable);
  const navigationConnectivity = routeConnectivityScore(routeConnectivity);
  const responsiveness = scoreResponsiveness(renderable);
  const previewUsefulness = uiQuality.passesPreview ? 90 : Math.max(20, uiQuality.score - 10);

  const score = Math.round(
    (routeCoverage +
      componentRichness +
      uiDensity +
      visualPolish +
      appSpecificLanguage +
      mockData +
      navigationConnectivity +
      responsiveness +
      previewUsefulness) /
      9,
  );

  const passes = score >= input.budget.minQualityScore && failures.length === 0;
  const needsContinuation =
    !passes &&
    (files < input.budget.minFiles ||
      routes < input.budget.minRoutes ||
      components < input.budget.minComponents);

  return {
    score,
    passes,
    tier: input.budget.tier,
    minRequiredScore: input.budget.minQualityScore,
    dimensions: {
      routeCoverage,
      componentRichness,
      uiDensity,
      visualPolish,
      appSpecificLanguage,
      mockData,
      navigationConnectivity,
      responsiveness,
      previewUsefulness,
    },
    counts: { files, routes, components },
    failures,
    routeConnectivity,
    needsRepair: !passes && !needsContinuation,
    needsContinuation,
  };
}

/** Separate generation quality from preview compile status (P1.3.15). */
export function splitGenerationAndPreviewScores(input: {
  generationReport: GeneratedAppQualityReport;
  previewBuildStatus?: "ready" | "failed" | "pending" | null;
  sourceIntegrityScore?: number | null;
}): {
  generation_quality_score: number;
  source_integrity_score: number;
  preview_build_status: string;
} {
  return {
    generation_quality_score: input.generationReport.score,
    source_integrity_score:
      input.sourceIntegrityScore ??
      Math.round(
        (input.generationReport.dimensions.routeCoverage +
          input.generationReport.dimensions.componentRichness) /
          2,
      ),
    preview_build_status: input.previewBuildStatus ?? "pending",
  };
}

export function formatQualitySummaryForStream(report: GeneratedAppQualityReport): string {
  const rc = report.routeConnectivity;
  return [
    `${report.counts.files} files · ${report.counts.routes} routes · ${report.counts.components} components`,
    `Routes verified: ${rc.verifiedCount}/${rc.totalCount}`,
    `Quality score: ${report.score}/${report.minRequiredScore}`,
  ].join(" · ");
}
