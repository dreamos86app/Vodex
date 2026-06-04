import { catalogAmountUsd } from "@/lib/billing/plan-billing-catalog";
import {
  BILLABLE_PLAN_DEFINITIONS,
  actionCreditsForBillablePlan,
  billablePlanDefinition,
  monthlyPriceUsd,
  type BillablePlanId,
} from "@/lib/billing/billable-plans";

export type UpgradePlanTarget = "starter" | "pro" | BillablePlanId;

export type BuildCreditsUpgradeOffer = {
  currentPlanLabel: string;
  nextPlanId: UpgradePlanTarget;
  nextPlanLabel: string;
  monthlyPriceUsd: number;
  buildCredits: number;
  actionCredits: number;
  perks: string[];
  ctaLabel: string;
};

const INFINITY_ORDER: BillablePlanId[] = [
  "infinity_i",
  "infinity_ii",
  "infinity_iii",
  "infinity_iv",
  "infinity_v",
  "infinity_vi",
  "infinity_vii",
];

function resolveNextBillablePlan(planId: string | null | undefined): BillablePlanId | null {
  const p = (planId ?? "free").toLowerCase();
  if (p === "free") return "starter";
  if (p === "starter") return "pro";
  if (p === "pro" || p === "infinity" || p === "enterprise") return "infinity_i";
  const idx = INFINITY_ORDER.indexOf(p as BillablePlanId);
  if (idx >= 0 && idx < INFINITY_ORDER.length - 1) return INFINITY_ORDER[idx + 1]!;
  if (idx === INFINITY_ORDER.length - 1) return null;
  return "starter";
}

function planLabel(planId: string): string {
  const p = planId.toLowerCase();
  const def = BILLABLE_PLAN_DEFINITIONS.find((d) => d.id === p || d.storagePlanId === p);
  if (def) return def.label;
  if (p === "free") return "Free";
  if (p === "infinity" || p === "enterprise") return "Infinity I";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function resolveBuildCreditsUpgradeOffer(planId: string | null | undefined): BuildCreditsUpgradeOffer {
  const normalized = (planId ?? "free").toLowerCase();
  const nextBillable = resolveNextBillablePlan(planId);
  const next: UpgradePlanTarget =
    nextBillable ??
    (normalized.startsWith("infinity") ? "infinity_vii" : "starter");
  const def = billablePlanDefinition(
    next === "starter" || next === "pro" ? next : (next as BillablePlanId),
  );

  const monthlyUsd =
    next === "starter"
      ? catalogAmountUsd("starter", "monthly")
      : next === "pro"
        ? catalogAmountUsd("pro", "monthly")
        : monthlyPriceUsd(def);

  const buildCredits = def.buildCredits;
  const actionCredits = actionCreditsForBillablePlan(def);

  const perks = [
    `${buildCredits.toLocaleString()} Build Credits / month`,
    `${actionCredits.toLocaleString()} Action Credits / month`,
    "Dedicated compute",
    "ZIP import & preview worker builds",
    "Priority support",
    "and more…",
  ];

  return {
    currentPlanLabel: planLabel(normalized),
    nextPlanId: next,
    nextPlanLabel: def.label,
    monthlyPriceUsd: monthlyUsd,
    buildCredits,
    actionCredits,
    perks,
    ctaLabel: `Upgrade to ${def.label} — $${monthlyUsd}/mo`,
  };
}

export function billablePlanForUpgrade(target: UpgradePlanTarget): BillablePlanId {
  if (target === "starter") return "starter";
  if (target === "pro") return "pro";
  return target;
}
