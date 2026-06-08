/**
 * P1.3.15 — Meaningful UI quality gate (content depth, not just file count).
 */
import { checkGeneratedUiQuality } from "@/lib/build/generated-ui-quality-checker";
import { checkAppSpecificLanguage } from "@/lib/build/app-specific-language-check";
import {
  checkRouteConnectivity,
  countAppRoutes,
} from "@/lib/build/route-connectivity-check";
import { countComponentFiles } from "@/lib/build/import-graph";
import {
  filterRenderableBuildFiles,
  countRenderablePages,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import { isGeneratedFileStub } from "@/lib/build/generated-file-stub";
import { fileMeetsMeaningfulThreshold } from "@/lib/build/source-integrity-validator";
import type { FullAppGenerationBudget } from "@/lib/build/full-app-generation-plan";
import { validateUiRichness } from "@/lib/build/ui-richness-validator";

const PLACEHOLDER_PRIMARY_RE =
  /coming\s+soon|^\s*todo\b|loading\.\.\.|no\s+data\s+available|welcome\s*\/\s*open\s+dashboard|metrics,\s*workflows,\s*and\s+team\s+tools/i;

const GENERIC_VIOLET_SCAFFOLD_RE =
  /bg-gradient-to-br\s+from-violet-600\s+to-indigo-700[\s\S]{0,400}Open dashboard/i;

export type MeaningfulUiQualityReport = {
  total_files: number;
  total_routes: number;
  meaningful_routes: number;
  placeholder_routes: number;
  wired_routes: number;
  component_count: number;
  app_specific_terms_count: number;
  mock_data_count: number;
  interactive_elements_count: number;
  visual_density_score: number;
  page_depth_score: number;
  final_quality_score: number;
  min_required_score: number;
  passes: boolean;
  failures: string[];
  warnings: string[];
  weak_file_paths: string[];
};

function countInteractiveElements(ui: string): number {
  return (
    (ui.match(/<button|onClick|href=|type="submit"/gi) ?? []).length +
    (ui.match(/<input|<select|<textarea/gi) ?? []).length
  );
}

function countMockDataSignals(files: BuildFile[]): number {
  const dataFiles = files.filter((f) => /mock-data|fixtures|sample-data/i.test(f.path));
  const ui = files
    .filter((f) => /\.(tsx|jsx)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");
  const arrays = (ui.match(/\[\s*\{[\s\S]{30,}/g) ?? []).length;
  return dataFiles.length * 3 + arrays;
}

function pageDepthScore(files: BuildFile[]): number {
  const pages = files.filter((f) => /\/page\.(tsx|jsx)$/i.test(f.path));
  if (!pages.length) return 0;
  let sum = 0;
  for (const p of pages) {
    const lines = p.content.split(/\r?\n/).length;
    const chars = p.content.length;
    const rich =
      (p.content.match(/className=/g) ?? []).length +
      (p.content.match(/<section|<article|<table/gi) ?? []).length;
    sum += Math.min(100, lines * 1.2 + chars / 40 + rich * 4);
  }
  return Math.round(sum / pages.length);
}

function isPlaceholderRoutePage(content: string, path: string): boolean {
  if (isGeneratedFileStub(content, path)) return true;
  if (PLACEHOLDER_PRIMARY_RE.test(content)) return true;
  if (/^app\/page\.(tsx|jsx)$/i.test(path) && GENERIC_VIOLET_SCAFFOLD_RE.test(content)) {
    return true;
  }
  if (!fileMeetsMeaningfulThreshold({ path, content })) return true;
  const tableOnly =
    /<table/i.test(content) &&
    !/<(section|article|chart|canvas)/i.test(content) &&
    content.length < 1200;
  return tableOnly;
}

export function scoreMeaningfulUiQuality(input: {
  files: BuildFile[];
  budget: FullAppGenerationBudget;
  userPrompt?: string;
  routeMap?: string[] | null;
}): MeaningfulUiQualityReport {
  const renderable = filterRenderableBuildFiles(input.files);
  const uiQuality = checkGeneratedUiQuality({
    files: renderable,
    routeMap: input.routeMap,
  });
  const language = checkAppSpecificLanguage({
    files: renderable,
    userPrompt: input.userPrompt,
  });
  const routeConnectivity = checkRouteConnectivity(renderable);
  const richness = validateUiRichness(renderable);

  const pages = renderable.filter((f) => /\/page\.(tsx|jsx)$/i.test(f.path));
  let meaningful_routes = 0;
  let placeholder_routes = 0;
  const weak_file_paths: string[] = [];

  for (const p of pages) {
    if (isPlaceholderRoutePage(p.content, p.path)) {
      placeholder_routes += 1;
      weak_file_paths.push(p.path);
    } else {
      meaningful_routes += 1;
    }
  }

  for (const f of renderable) {
    if (/components\//i.test(f.path) && !fileMeetsMeaningfulThreshold(f)) {
      weak_file_paths.push(f.path);
    }
  }

  const ui = renderable
    .filter((f) => /\.(tsx|jsx)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");

  const failures: string[] = [];
  const warnings: string[] = [];

  if (meaningful_routes < Math.max(3, Math.floor(input.budget.minRoutes * 0.6))) {
    failures.push(`meaningful_routes_${meaningful_routes}_low`);
  }
  if (placeholder_routes > Math.max(2, Math.floor(pages.length * 0.35))) {
    failures.push(`placeholder_routes_${placeholder_routes}`);
  }
  if (!routeConnectivity.passes) failures.push(...routeConnectivity.failures);
  if (!language.passes) failures.push("generic_shell_language");
  if (uiQuality.basicUiFailure) failures.push("basic_ui_failure");
  if (GENERIC_VIOLET_SCAFFOLD_RE.test(ui)) failures.push("generic_violet_scaffold");

  if (placeholder_routes > 0 && placeholder_routes <= 3) {
    warnings.push(`${placeholder_routes} secondary route(s) still thin`);
  }

  const visual_density_score = Math.min(100, richness.score);
  const page_depth_score = pageDepthScore(renderable);
  const app_specific_terms_count = Math.max(0, 100 - language.scorePenalty);
  const mock_data_count = countMockDataSignals(renderable);
  const interactive_elements_count = countInteractiveElements(ui);

  const final_quality_score = Math.round(
    (visual_density_score * 0.2 +
      page_depth_score * 0.25 +
      uiQuality.score * 0.2 +
      app_specific_terms_count * 0.15 +
      routeConnectivity.verifiedCount / Math.max(1, routeConnectivity.totalCount) * 100 * 0.1 +
      Math.min(100, mock_data_count * 8) * 0.05 +
      Math.min(100, interactive_elements_count * 2) * 0.05),
  );

  const min_required_score = input.budget.minQualityScore;
  const passes =
    final_quality_score >= min_required_score &&
    failures.length === 0 &&
    meaningful_routes >= 3 &&
    placeholder_routes <= Math.max(1, Math.floor(pages.length * 0.1));

  return {
    total_files: renderable.length,
    total_routes: countAppRoutes(renderable),
    meaningful_routes,
    placeholder_routes,
    wired_routes: routeConnectivity.verifiedCount,
    component_count: countComponentFiles(renderable),
    app_specific_terms_count,
    mock_data_count,
    interactive_elements_count,
    visual_density_score,
    page_depth_score,
    final_quality_score,
    min_required_score,
    passes,
    failures,
    warnings,
    weak_file_paths: [...new Set(weak_file_paths)].slice(0, 24),
  };
}

export function formatMeaningfulQualityForStream(report: MeaningfulUiQualityReport): string {
  return [
    `${report.total_files} files · ${report.meaningful_routes}/${report.total_routes} meaningful routes`,
    `${report.component_count} components · wired ${report.wired_routes}`,
    `Quality score: ${report.final_quality_score}/${report.min_required_score}`,
  ].join(" · ");
}
