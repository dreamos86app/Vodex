/**
 * UI richness scoring — rejects weak, generic, low-density generations.
 */
import type { BuildFile } from "@/lib/build/generated-file-utils";
import { dashboardQualityScore } from "@/lib/build/dashboard-quality-validator";

export const UI_RICHNESS_MIN_SCORE = 85;

export type UiRichnessResult = {
  score: number;
  passes: boolean;
  failures: string[];
  dashboardScore: number;
};

function collectUiContent(files: BuildFile[]): string {
  return files
    .filter((f) => /\.(tsx|jsx)$/i.test(f.path))
    .map((f) => f.content)
    .join("\n");
}

/** Holistic UI density / polish score across generated TSX. */
export function validateUiRichness(files: BuildFile[]): UiRichnessResult {
  const ui = collectUiContent(files);
  const failures: string[] = [];
  const dash = dashboardQualityScore(files);

  let score = 50;

  const gradients = (ui.match(/gradient|from-|to-|bg-\[/gi) ?? []).length;
  const icons = (ui.match(/lucide|Icon|svg/gi) ?? []).length;
  const tables = (ui.match(/<table|TableHeader|thead/gi) ?? []).length;
  const lists = (ui.match(/\.map\s*\(|map\(/g) ?? []).length;
  const charts = dash.stats.chartCount;
  const uniqueComponents = new Set(
    (ui.match(/<([A-Z][A-Za-z0-9]+)/g) ?? []).map((m) => m.slice(1)),
  ).size;

  score += Math.min(gradients, 8) * 2;
  score += Math.min(icons, 12) * 2;
  score += Math.min(tables, 3) * 6;
  score += Math.min(lists, 10) * 2;
  score += charts * 8;
  score += Math.min(uniqueComponents, 20);

  if (gradients < 2) failures.push("low_visual_polish");
  if (uniqueComponents < 6) failures.push("low_component_diversity");
  if (tables + lists < 3) failures.push("sparse_data_views");

  score = Math.round(Math.max(0, Math.min(100, (score + dash.score) / 2)));

  if (!dash.passes) {
    failures.push(...dash.failures.map((f) => `dashboard_${f}`));
  }

  const passes = score >= UI_RICHNESS_MIN_SCORE && dash.passes && failures.length === 0;

  return {
    score,
    passes,
    failures,
    dashboardScore: dash.score,
  };
}
