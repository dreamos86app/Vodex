import { computePlanEconomics, type PlanEconomicsRow } from "@/lib/billing/plan-credit-economics";

/** Self-serve plans shown in docs and pricing (canonical economics). */
export const SELF_SERVE_DOC_PLAN_IDS = [
  "free",
  "starter",
  "pro",
  "infinity_i",
  "infinity_ii",
  "infinity_iii",
  "infinity_iv",
  "infinity_v",
  "infinity_vi",
  "infinity_vii",
] as const;

export function allSelfServePlanEconomicsRows(): PlanEconomicsRow[] {
  return SELF_SERVE_DOC_PLAN_IDS.map((id) => computePlanEconomics(id));
}

export function buildPlanCreditsMarkdownTable(): string {
  const rows = allSelfServePlanEconomicsRows();
  const lines = [
    "| Plan | Build Credits / mo | Action Credits / mo |",
    "|------|-------------------|---------------------|",
    ...rows.map(
      (r) =>
        `| ${r.name} | ${r.buildCredits.toLocaleString("en-US")} | ${r.actionCredits.toLocaleString("en-US")} |`,
    ),
  ];
  return lines.join("\n");
}
