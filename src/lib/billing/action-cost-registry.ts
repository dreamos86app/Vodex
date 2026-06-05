/**
 * Action Credit cost registry — estimated provider/infrastructure USD per action.
 * P5.4.4: reduced provider estimates from routing/worker optimizations.
 */
import { quoteActionCredits } from "@/lib/action-credits/action-credit-pricing";
import { MOBILE_PROVIDER_COST_USD } from "@/lib/mobile/action-pricing";

export type ActionCostRow = {
  actionType: string;
  label: string;
  providerCostUsd: number;
  infrastructureCostUsd: number;
  quotedCredits: number;
  marginMultiplier: number;
};

export const ACTION_PROVIDER_COST_USD: Record<string, { provider: number; infra?: number }> = {
  zip_scan: { provider: 0.013, infra: 0.004 },
  zip_preview_tier1: { provider: 0.045, infra: 0.017 },
  zip_preview_tier2: { provider: 0.095, infra: 0.026 },
  zip_preview_tier3: { provider: 0.2, infra: 0.043 },
  zip_preview_tier4: { provider: 0.38, infra: 0.068 },
  zip_preview_build: { provider: 0.38, infra: 0.068 },
  preview_rebuild: { provider: 0.06, infra: 0.017 },
  publish_web: { provider: 0.026, infra: 0.009 },
  android_build: { provider: MOBILE_PROVIDER_COST_USD.android_build ?? 0.1, infra: 0.025 },
  android_aab: { provider: 0.13, infra: 0.03 },
  ios_build: { provider: MOBILE_PROVIDER_COST_USD.ios_build ?? 0.16, infra: 0.035 },
  app_icon_ai_generation: { provider: 0.035, infra: 0.004 },
  app_logo_generation: { provider: 0.05, infra: 0.007 },
  app_logo_regeneration: { provider: 0.05, infra: 0.007 },
  splash_ai_generation: { provider: 0.04, infra: 0.005 },
  image_standard: { provider: 0.04, infra: 0.007 },
  image_premium: { provider: 0.1, infra: 0.012 },
  store_metadata_ai_generation: { provider: 0.016, infra: 0.002 },
  llm_generation_simple: { provider: 0.007, infra: 0.002 },
  llm_generation_standard: { provider: 0.024, infra: 0.004 },
  email_send_notification: { provider: 0.0025, infra: 0.0005 },
  runtime_llm_small: { provider: 0.008, infra: 0.0015 },
  webhook_call: { provider: 0.0015, infra: 0.0004 },
  payment_event: { provider: 0.003, infra: 0.001 },
  analytics_event: { provider: 0.0007, infra: 0.0002 },
  notification_broadcast: { provider: 0.004, infra: 0.001 },
};

export function actionCostRegistryRows(): ActionCostRow[] {
  return Object.entries(ACTION_PROVIDER_COST_USD).map(([actionType, costs]) => {
    const totalCostUsd = costs.provider + (costs.infra ?? 0);
    const quote = quoteActionCredits({ actionType, providerCostUsd: totalCostUsd });
    const finalCredits = quote.finalActionCredits;
    const revenue = finalCredits * (20 / 400);
    const mult = totalCostUsd > 0 ? revenue / totalCostUsd : 5;
    return {
      actionType,
      label: actionType.replace(/_/g, " "),
      providerCostUsd: costs.provider,
      infrastructureCostUsd: costs.infra ?? 0,
      quotedCredits: finalCredits,
      marginMultiplier: mult,
    };
  });
}

export function assertActionRegistryMeetsMarginTarget(minMultiplier = 5): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  for (const row of actionCostRegistryRows()) {
    const total = row.providerCostUsd + row.infrastructureCostUsd;
    if (total <= 0) continue;
    if (row.marginMultiplier < minMultiplier - 0.01) {
      failures.push(
        `${row.actionType}: ${row.marginMultiplier.toFixed(2)}x < ${minMultiplier}x (cost $${total.toFixed(4)}, ${row.quotedCredits} AC)`,
      );
    }
  }
  return { ok: failures.length === 0, failures };
}
