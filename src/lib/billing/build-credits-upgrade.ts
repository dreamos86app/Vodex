import { planPricingCardCopy } from "@/lib/billing/plan-credit-economics";
import { catalogAmountUsd } from "@/lib/billing/plan-billing-catalog";
import type { BillablePlanId } from "@/lib/billing/billable-plans";

export type UpgradePlanTarget = "starter" | "pro" | "infinity";

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

const NEXT_PLAN: Record<string, UpgradePlanTarget> = {
  free: "starter",
  starter: "pro",
  pro: "infinity",
  infinity: "infinity",
  enterprise: "infinity",
};

const PERKS: Record<UpgradePlanTarget, string[]> = {
  starter: [
    "200 Build Credits / month",
    "500 Action Credits / month",
    "Unlimited projects",
    "Faster generation",
    "Edit & Build modes",
    "Priority improvements",
    "and more…",
  ],
  pro: [
    "500 Build Credits / month",
    "1,250 Action Credits / month",
    "All frontier models",
    "5 collaborators",
    "ZIP import & API access",
    "Publish & custom domains",
    "and more…",
  ],
  infinity: [
    "1,000–13,000 Build Credits / month",
    "Scaled Action Credits",
    "Dedicated compute",
    "White-label & SSO",
    "Priority support",
    "Mobile wrapper workflows",
    "and more…",
  ],
};

export function resolveBuildCreditsUpgradeOffer(planId: string | null | undefined): BuildCreditsUpgradeOffer {
  const normalized = (planId ?? "free").toLowerCase();
  const next = NEXT_PLAN[normalized] ?? "starter";
  const card = planPricingCardCopy(next === "infinity" ? "infinity" : next);
  const monthlyPriceUsd =
    next === "starter"
      ? catalogAmountUsd("starter", "monthly")
      : next === "pro"
        ? catalogAmountUsd("pro", "monthly")
        : catalogAmountUsd("infinity_i", "monthly");

  const currentLabel =
    normalized === "free"
      ? "Free"
      : normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return {
    currentPlanLabel: currentLabel,
    nextPlanId: next,
    nextPlanLabel: next === "infinity" ? "Infinity I" : next.charAt(0).toUpperCase() + next.slice(1),
    monthlyPriceUsd,
    buildCredits: card.buildCredits,
    actionCredits: card.actionCredits,
    perks: PERKS[next],
    ctaLabel: `Upgrade to ${next === "infinity" ? "Infinity I" : next.charAt(0).toUpperCase() + next.slice(1)} — $${monthlyPriceUsd}/mo`,
  };
}

export function billablePlanForUpgrade(target: UpgradePlanTarget): BillablePlanId {
  if (target === "starter") return "starter";
  if (target === "pro") return "pro";
  return "infinity_i";
}
