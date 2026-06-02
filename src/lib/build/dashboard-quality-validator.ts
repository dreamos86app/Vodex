/**
 * Hard validation for dashboard/home route richness — rejects empty shells.
 */
import type { BuildFile } from "@/lib/build/generated-file-utils";

export const DASHBOARD_QUALITY_MIN_SCORE = 85;

export type DashboardQualityResult = {
  score: number;
  passes: boolean;
  failures: string[];
  stats: {
    cardCount: number;
    chartCount: number;
    sectionCount: number;
    actionCount: number;
    mockDataSignals: number;
  };
};

function findDashboardContent(files: BuildFile[]): string {
  const dash =
    files.find((f) => /app\/dashboard\/page\.tsx$/i.test(f.path)) ??
    files.find((f) => /dashboard\/page\.tsx$/i.test(f.path)) ??
    files.find((f) => /app\/page\.tsx$/i.test(f.path));
  return dash?.content ?? "";
}

function countCards(content: string): number {
  const patterns = [
    /\bCard\b/g,
    /rounded-(?:lg|xl|2xl|3xl)/g,
    /(?:KPI|metric|stat|overview)/gi,
    /grid-cols-\d/g,
    /className="[^"]*(?:shadow|border)[^"]*"/g,
  ];
  let max = 0;
  for (const p of patterns) {
    max = Math.max(max, (content.match(p) ?? []).length);
  }
  const gridCards = (content.match(/<div[^>]+className="[^"]*p-\d[^"]*"/g) ?? []).length;
  return Math.max(max, Math.min(gridCards, 12));
}

function countCharts(content: string): number {
  const chartSignals = [
    /recharts|AreaChart|BarChart|LineChart|PieChart|ResponsiveContainer/i,
    /<svg[^>]*>[\s\S]*?<\/svg>/gi,
    /chart|graph|sparkline|trend/gi,
    /data:\s*\[/,
    /points:\s*\[/,
  ];
  let n = 0;
  for (const p of chartSignals) {
    if (p.test(content)) n += 1;
  }
  return Math.min(n, 6);
}

function countSections(content: string): number {
  const h2 = (content.match(/<h2|<section|divide-y|border-t/gi) ?? []).length;
  const titled = (content.match(/(?:Recent|Top|Overview|Performance|Activity|Campaign)/gi) ?? []).length;
  return h2 + Math.min(titled, 4);
}

function countActions(content: string): number {
  return (content.match(/<Button|button\s|href=|onClick=/gi) ?? []).length;
}

function mockDataSignals(content: string): number {
  let n = 0;
  if (/\[\s*\{[\s\S]*?\}\s*,\s*\{/.test(content)) n += 2;
  if (/\$[\d,]+|\d+%|Jan|Feb|Mar|Apr|signup|affiliate|campaign/i.test(content)) n += 1;
  if (/(?:name|email|status|revenue|conversion):\s*['"`]/i.test(content)) n += 1;
  if ((content.match(/\d{2,}/g) ?? []).length >= 6) n += 1;
  return n;
}

/** Score dashboard route 0–100; pass at ≥ DASHBOARD_QUALITY_MIN_SCORE. */
export function dashboardQualityScore(files: BuildFile[]): DashboardQualityResult {
  const content = findDashboardContent(files);
  const failures: string[] = [];

  if (!content.trim()) {
    return {
      score: 0,
      passes: false,
      failures: ["dashboard_missing"],
      stats: { cardCount: 0, chartCount: 0, sectionCount: 0, actionCount: 0, mockDataSignals: 0 },
    };
  }

  const cardCount = countCards(content);
  const chartCount = countCharts(content);
  const sectionCount = countSections(content);
  const actionCount = countActions(content);
  const mockSignals = mockDataSignals(content);

  let score = 40;
  score += Math.min(cardCount, 6) * 8;
  score += chartCount >= 1 ? 18 : 0;
  score += Math.min(sectionCount, 4) * 5;
  score += Math.min(actionCount, 6) * 3;
  score += Math.min(mockSignals, 4) * 5;

  if (cardCount < 3) failures.push("dashboard_cards_lt_3");
  if (chartCount < 1) failures.push("dashboard_no_chart");
  if (sectionCount < 2) failures.push("dashboard_sections_lt_2");
  if (actionCount < 2) failures.push("dashboard_actions_lt_2");
  if (mockSignals < 2) failures.push("dashboard_weak_mock_data");

  if (/welcome to|get started with your app/i.test(content) && cardCount < 4 && chartCount < 1) {
    failures.push("dashboard_welcome_shell");
    score -= 25;
  }

  const whitespaceRatio =
    (content.match(/\{\s*\}/g) ?? []).length + (content.match(/>\s*<\//g) ?? []).length;
  if (whitespaceRatio > 8 && cardCount < 3) {
    failures.push("dashboard_mostly_empty");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));
  const passes = score >= DASHBOARD_QUALITY_MIN_SCORE && failures.length === 0;

  return {
    score,
    passes,
    failures,
    stats: { cardCount, chartCount, sectionCount, actionCount, mockDataSignals: mockSignals },
  };
}
