import { FILE_PAYLOAD_RULE } from "@/lib/build/stage-prompts";
import type { DesignBrief } from "@/lib/build/design-brief-generator";
import { formatQualityContractForPrompt } from "@/lib/build/ui-quality-contract";
import type { GeneratedUiQualityResult } from "@/lib/build/generated-ui-quality-checker";

export type BuildFile = { path: string; content: string };

export function buildPremiumUiRepairPrompt(input: {
  designBrief: DesignBrief;
  quality: GeneratedUiQualityResult;
  files: BuildFile[];
  userPrompt: string;
}): string {
  const home = input.files.find((f) => /app\/page\.tsx$/i.test(f.path));
  const excerpt = (home?.content ?? input.files[0]?.content ?? "").slice(0, 2500);

  return [
    FILE_PAYLOAD_RULE,
    "PREMIUM UI REPAIR PASS",
    "The current generated UI is too basic. Upgrade it into a premium SaaS-quality interface while preserving the app purpose and routes.",
    "Do NOT return a simple Welcome headline with 3 plain stacked cards.",
    "Add: app shell, navigation, rich dashboard sections, realistic sample data, tables/charts where relevant, filters, empty/loading/error states.",
    "Dashboard MUST have: 4+ KPI cards, at least 1 chart with data series, 2+ sections (recent activity, leaderboard, funnel), 2+ CTAs, launch-style gradients.",
    "Preserve existing route paths; improve layout, spacing, typography, icons, and hierarchy.",
    input.designBrief.promptBlock,
    formatQualityContractForPrompt(),
    `Quality score was ${input.quality.score}/100 (need ≥ 85). Failures: ${input.quality.failures.join("; ") || "layout too shallow"}`,
    `User intent (context only): ${input.userPrompt.slice(0, 400)}`,
    excerpt ? `\nCurrent home page excerpt to upgrade:\n${excerpt}` : "",
    "Return the full repaired file set as JSON files array.",
  ].join("\n\n");
}
