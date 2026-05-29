import { normalizePlanId } from "@/lib/billing/plans";

type PlanSlug = "free" | "starter" | "pro" | "business" | "enterprise" | "infinity";

export type MobileEntitlement =
  | "mobile_wrapper_view"
  | "mobile_android_build"
  | "mobile_ios_build"
  | "mobile_store_publish_helper"
  | "mobile_push_notifications"
  | "mobile_custom_signing"
  | "mobile_white_label";

const ENTITLEMENTS: Record<MobileEntitlement, PlanSlug[]> = {
  mobile_wrapper_view: ["free", "starter", "pro", "business", "enterprise", "infinity"],
  mobile_android_build: ["starter", "pro", "business", "enterprise", "infinity"],
  mobile_ios_build: ["pro", "business", "enterprise", "infinity"],
  mobile_store_publish_helper: ["pro", "business", "enterprise", "infinity"],
  mobile_push_notifications: ["pro", "business", "enterprise", "infinity"],
  mobile_custom_signing: ["business", "enterprise", "infinity"],
  mobile_white_label: ["enterprise", "infinity"],
};

function entitlementPlanSlug(planId: string): PlanSlug {
  const plan = normalizePlanId(planId);
  if (plan.startsWith("infinity_") || plan === "infinity" || plan === "enterprise") return "infinity";
  if (plan === "business") return "pro";
  return plan as PlanSlug;
}

export function hasMobileEntitlement(
  planId: string | null | undefined,
  key: MobileEntitlement,
): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const plan = entitlementPlanSlug(planId ?? "free");
  return ENTITLEMENTS[key].includes(plan);
}

export function mobileEntitlementsForPlan(planId: string | null | undefined): Record<MobileEntitlement, boolean> {
  return {
    mobile_wrapper_view: hasMobileEntitlement(planId, "mobile_wrapper_view"),
    mobile_android_build: hasMobileEntitlement(planId, "mobile_android_build"),
    mobile_ios_build: hasMobileEntitlement(planId, "mobile_ios_build"),
    mobile_store_publish_helper: hasMobileEntitlement(planId, "mobile_store_publish_helper"),
    mobile_push_notifications: hasMobileEntitlement(planId, "mobile_push_notifications"),
    mobile_custom_signing: hasMobileEntitlement(planId, "mobile_custom_signing"),
    mobile_white_label: hasMobileEntitlement(planId, "mobile_white_label"),
  };
}

/** @deprecated use hasMobileEntitlement(planId, 'mobile_android_build') */
export function planAllowsAndroidWrap(planId: string | null | undefined): boolean {
  return hasMobileEntitlement(planId, "mobile_android_build");
}
