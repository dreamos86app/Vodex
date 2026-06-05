import { quoteActionCredits } from "@/lib/action-credits/action-credit-pricing";

/** Deterministic mobile operations — never charged. */
export const FREE_MOBILE_ACTIONS = new Set([
  "mobile_readiness_scan",
  "mobile_config_save",
  "mobile_wrapper_zip_local",
]);

export type MobileActionType =
  | "mobile_readiness_scan"
  | "android_build"
  | "ios_build"
  | "mobile_artifact_storage"
  | "app_icon_ai_generation"
  | "splash_ai_generation"
  | "store_metadata_ai_generation"
  | "push_notification_send"
  | "store_publish_attempt"
  | "mobile_wrapper_zip_local";

/** Estimated provider/infrastructure cost USD — admin only. */
/** P5.4.4 — builder cache + shorter worker runs lower provider estimates. */
export const MOBILE_PROVIDER_COST_USD: Partial<Record<MobileActionType, number>> = {
  android_build: 0.1,
  ios_build: 0.16,
  mobile_artifact_storage: 0.018,
  app_icon_ai_generation: 0.035,
  splash_ai_generation: 0.05,
  store_metadata_ai_generation: 0.016,
  push_notification_send: 0.001,
  store_publish_attempt: 0.01,
};

export function quoteMobileAction(actionType: MobileActionType): {
  actionType: MobileActionType;
  actionCredits: number;
  isFree: boolean;
  requiresApproval: boolean;
  label: string;
} {
  if (FREE_MOBILE_ACTIONS.has(actionType)) {
    return {
      actionType,
      actionCredits: 0,
      isFree: true,
      requiresApproval: false,
      label: "No Action Credits required",
    };
  }

  const providerCost = MOBILE_PROVIDER_COST_USD[actionType] ?? 0;
  const quote = quoteActionCredits({ actionType, providerCostUsd: providerCost });
  return {
    actionType,
    actionCredits: quote.finalActionCredits,
    isFree: quote.isFree,
    requiresApproval: quote.finalActionCredits > 0,
    label:
      quote.finalActionCredits > 0
        ? `Up to ${quote.finalActionCredits} Action Credits`
        : "No Action Credits required",
  };
}
