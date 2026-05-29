import type { PlanId } from "@/lib/supabase/types";

const KNOWN_PLANS: PlanId[] = [
  "free",
  "starter",
  "pro",
  "business",
  "infinity",
  "infinity_i",
  "infinity_ii",
  "infinity_iii",
  "infinity_iv",
  "infinity_v",
  "infinity_vi",
  "infinity_vii",
  "enterprise",
];

export function normalizePlanId(plan: string): PlanId {
  if (plan === "business") return "pro";
  if (plan === "enterprise" || plan === "infinity") return "infinity_i";
  if ((KNOWN_PLANS as string[]).includes(plan)) return plan as PlanId;
  return "free";
}
