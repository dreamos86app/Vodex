/**
 * Full Vodex action cost catalog — P5.4.4 optimized (provider + consumption).
 */

export const ACTION_CREDITS_PER_DOLLAR_RATIO = 20;
export const BUILD_REVENUE_USD_PER_CREDIT = 0.1;
export const STARTER_ACTION_REVENUE_USD = 20 / 400;

/** Pre-P5.4.4 baseline for delta reporting. */
export const ACTION_CATALOG_BASELINE = [
  { id: "discuss_message", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.00048, infraUsd: 0.0001, creditKind: "build", creditCost: 0.3 },
  { id: "build_plan", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.004, infraUsd: 0.001, creditKind: "build", creditCost: 1 },
  { id: "generate_app_simple", category: "ai", provider: "mixed-cheap", providerUsd: 0.08, infraUsd: 0.02, creditKind: "build", creditCost: 5 },
  { id: "generate_app_medium", category: "ai", provider: "mixed-standard", providerUsd: 0.18, infraUsd: 0.04, creditKind: "build", creditCost: 11 },
  { id: "generate_app_complex", category: "ai", provider: "premium-final-pass", providerUsd: 0.45, infraUsd: 0.08, creditKind: "build", creditCost: 27 },
  { id: "edit_app_small", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.02, infraUsd: 0.005, creditKind: "build", creditCost: 2 },
  { id: "edit_app_medium", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.05, infraUsd: 0.01, creditKind: "build", creditCost: 5 },
  { id: "edit_app_large", category: "ai", provider: "standard", providerUsd: 0.12, infraUsd: 0.02, creditKind: "build", creditCost: 12 },
  { id: "repair_app", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.04, infraUsd: 0.01, creditKind: "build", creditCost: 4 },
  { id: "summarize_project", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.006, infraUsd: 0.001, creditKind: "build", creditCost: 1 },
  { id: "ai_tool_call", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.003, infraUsd: 0.001, creditKind: "build", creditCost: 1 },
  { id: "zip_scan", category: "preview", provider: "worker", providerUsd: 0.01, infraUsd: 0.005, creditKind: "action", creditCost: 2 },
  { id: "zip_preview_tier1", category: "preview", provider: "worker", providerUsd: 0.03, infraUsd: 0.02, creditKind: "action", creditCost: 10 },
  { id: "zip_preview_tier2", category: "preview", provider: "worker", providerUsd: 0.08, infraUsd: 0.03, creditKind: "action", creditCost: 25 },
  { id: "zip_preview_tier3", category: "preview", provider: "worker", providerUsd: 0.18, infraUsd: 0.05, creditKind: "action", creditCost: 50 },
  { id: "zip_preview_tier4", category: "preview", provider: "worker", providerUsd: 0.45, infraUsd: 0.08, creditKind: "action", creditCost: 125 },
  { id: "preview_rebuild", category: "preview", provider: "worker", providerUsd: 0.05, infraUsd: 0.02, creditKind: "action", creditCost: 15 },
  { id: "publish_web", category: "preview", provider: "vercel-edge", providerUsd: 0.02, infraUsd: 0.01, creditKind: "action", creditCost: 5 },
  { id: "route_discovery", category: "preview", provider: "worker", providerUsd: 0.008, infraUsd: 0.002, creditKind: "action", creditCost: 2 },
  { id: "package_repair", category: "preview", provider: "worker", providerUsd: 0.04, infraUsd: 0.01, creditKind: "action", creditCost: 10 },
  { id: "worker_build_minute", category: "preview", provider: "worker", providerUsd: 0.02, infraUsd: 0.005, creditKind: "action", creditCost: 5 },
  { id: "artifact_storage_gb", category: "preview", provider: "storage", providerUsd: 0.005, infraUsd: 0.002, creditKind: "action", creditCost: 2 },
  { id: "artifact_egress_gb", category: "preview", provider: "egress", providerUsd: 0.01, infraUsd: 0.003, creditKind: "action", creditCost: 3 },
  { id: "app_icon", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.035, infraUsd: 0.005, creditKind: "action", creditCost: 8 },
  { id: "app_logo", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.05, infraUsd: 0.008, creditKind: "action", creditCost: 12 },
  { id: "splash_screen", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.04, infraUsd: 0.006, creditKind: "action", creditCost: 10 },
  { id: "store_screenshot", category: "image", provider: "template+mini", providerUsd: 0.025, infraUsd: 0.005, creditKind: "action", creditCost: 6 },
  { id: "marketing_image", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.045, infraUsd: 0.008, creditKind: "action", creditCost: 10 },
  { id: "image_premium", category: "image", provider: "gpt-image-1", providerUsd: 0.12, infraUsd: 0.015, creditKind: "action", creditCost: 35 },
  { id: "mobile_readiness_scan", category: "mobile", provider: "local", providerUsd: 0, infraUsd: 0, creditKind: "action", creditCost: 0 },
  { id: "android_wrapper_zip", category: "mobile", provider: "local", providerUsd: 0, infraUsd: 0, creditKind: "action", creditCost: 0 },
  { id: "android_apk", category: "mobile", provider: "builder-worker", providerUsd: 0.12, infraUsd: 0.03, creditKind: "action", creditCost: 30 },
  { id: "android_aab", category: "mobile", provider: "builder-worker", providerUsd: 0.15, infraUsd: 0.04, creditKind: "action", creditCost: 38 },
  { id: "ios_package", category: "mobile", provider: "worker", providerUsd: 0.18, infraUsd: 0.04, creditKind: "action", creditCost: 45 },
  { id: "store_metadata_ai", category: "mobile", provider: "gpt-4o-mini", providerUsd: 0.015, infraUsd: 0.003, creditKind: "action", creditCost: 4 },
  { id: "integration_test", category: "integration", provider: "api-ping", providerUsd: 0.001, infraUsd: 0.0005, creditKind: "action", creditCost: 1 },
  { id: "runtime_llm_small", category: "runtime", provider: "gpt-4o-mini", providerUsd: 0.008, infraUsd: 0.002, creditKind: "action", creditCost: 2 },
  { id: "runtime_llm_standard", category: "runtime", provider: "standard", providerUsd: 0.025, infraUsd: 0.005, creditKind: "action", creditCost: 6 },
  { id: "webhook_processing", category: "runtime", provider: "edge", providerUsd: 0.001, infraUsd: 0.0005, creditKind: "action", creditCost: 1 },
  { id: "payment_event", category: "runtime", provider: "worker", providerUsd: 0.002, infraUsd: 0.001, creditKind: "action", creditCost: 1 },
  { id: "analytics_event", category: "runtime", provider: "db-write", providerUsd: 0.0005, infraUsd: 0.0002, creditKind: "action", creditCost: 1 },
  { id: "notification_broadcast", category: "runtime", provider: "worker", providerUsd: 0.003, infraUsd: 0.001, creditKind: "action", creditCost: 1 },
  { id: "email_send", category: "runtime", provider: "resend", providerUsd: 0.002, infraUsd: 0.0005, creditKind: "action", creditCost: 1 },
];

/** P5.4.4 — optimized provider estimates + modest consumption bumps (≤20%). */
export const ACTION_CATALOG = [
  { id: "discuss_message", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.00048, infraUsd: 0.0001, creditKind: "build", creditCost: 0.3 },
  { id: "build_plan", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.0035, infraUsd: 0.001, creditKind: "build", creditCost: 1 },
  { id: "generate_app_simple", category: "ai", provider: "mixed-cheap", providerUsd: 0.07, infraUsd: 0.017, creditKind: "build", creditCost: 6 },
  { id: "generate_app_medium", category: "ai", provider: "mixed-standard", providerUsd: 0.155, infraUsd: 0.035, creditKind: "build", creditCost: 13 },
  { id: "generate_app_complex", category: "ai", provider: "premium-final-pass", providerUsd: 0.38, infraUsd: 0.068, creditKind: "build", creditCost: 31 },
  { id: "edit_app_small", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.02, infraUsd: 0.005, creditKind: "build", creditCost: 2 },
  { id: "edit_app_medium", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.05, infraUsd: 0.01, creditKind: "build", creditCost: 6 },
  { id: "edit_app_large", category: "ai", provider: "standard", providerUsd: 0.105, infraUsd: 0.017, creditKind: "build", creditCost: 14 },
  { id: "repair_app", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.04, infraUsd: 0.01, creditKind: "build", creditCost: 4 },
  { id: "summarize_project", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.006, infraUsd: 0.001, creditKind: "build", creditCost: 1 },
  { id: "ai_tool_call", category: "ai", provider: "gpt-4o-mini", providerUsd: 0.003, infraUsd: 0.001, creditKind: "build", creditCost: 1 },
  { id: "zip_scan", category: "preview", provider: "worker", providerUsd: 0.009, infraUsd: 0.004, creditKind: "action", creditCost: 2 },
  { id: "zip_preview_tier1", category: "preview", provider: "worker", providerUsd: 0.027, infraUsd: 0.017, creditKind: "action", creditCost: 11 },
  { id: "zip_preview_tier2", category: "preview", provider: "worker", providerUsd: 0.072, infraUsd: 0.026, creditKind: "action", creditCost: 28 },
  { id: "zip_preview_tier3", category: "preview", provider: "worker", providerUsd: 0.16, infraUsd: 0.043, creditKind: "action", creditCost: 56 },
  { id: "zip_preview_tier4", category: "preview", provider: "worker", providerUsd: 0.38, infraUsd: 0.068, creditKind: "action", creditCost: 140 },
  { id: "preview_rebuild", category: "preview", provider: "worker", providerUsd: 0.045, infraUsd: 0.017, creditKind: "action", creditCost: 17 },
  { id: "publish_web", category: "preview", provider: "vercel-edge", providerUsd: 0.018, infraUsd: 0.009, creditKind: "action", creditCost: 5 },
  { id: "route_discovery", category: "preview", provider: "worker", providerUsd: 0.007, infraUsd: 0.002, creditKind: "action", creditCost: 2 },
  { id: "package_repair", category: "preview", provider: "worker", providerUsd: 0.036, infraUsd: 0.009, creditKind: "action", creditCost: 11 },
  { id: "worker_build_minute", category: "preview", provider: "worker", providerUsd: 0.018, infraUsd: 0.004, creditKind: "action", creditCost: 5 },
  { id: "artifact_storage_gb", category: "preview", provider: "storage", providerUsd: 0.0045, infraUsd: 0.002, creditKind: "action", creditCost: 2 },
  { id: "artifact_egress_gb", category: "preview", provider: "egress", providerUsd: 0.009, infraUsd: 0.003, creditKind: "action", creditCost: 3 },
  { id: "app_icon", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.032, infraUsd: 0.004, creditKind: "action", creditCost: 8 },
  { id: "app_logo", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.045, infraUsd: 0.007, creditKind: "action", creditCost: 12 },
  { id: "splash_screen", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.036, infraUsd: 0.005, creditKind: "action", creditCost: 10 },
  { id: "store_screenshot", category: "image", provider: "template+mini", providerUsd: 0.022, infraUsd: 0.004, creditKind: "action", creditCost: 6 },
  { id: "marketing_image", category: "image", provider: "gpt-image-1-mini", providerUsd: 0.04, infraUsd: 0.007, creditKind: "action", creditCost: 10 },
  { id: "image_premium", category: "image", provider: "gpt-image-1", providerUsd: 0.1, infraUsd: 0.012, creditKind: "action", creditCost: 40 },
  { id: "mobile_readiness_scan", category: "mobile", provider: "local", providerUsd: 0, infraUsd: 0, creditKind: "action", creditCost: 0 },
  { id: "android_wrapper_zip", category: "mobile", provider: "local", providerUsd: 0, infraUsd: 0, creditKind: "action", creditCost: 0 },
  { id: "android_apk", category: "mobile", provider: "builder-worker", providerUsd: 0.1, infraUsd: 0.025, creditKind: "action", creditCost: 35 },
  { id: "android_aab", category: "mobile", provider: "builder-worker", providerUsd: 0.13, infraUsd: 0.03, creditKind: "action", creditCost: 45 },
  { id: "ios_package", category: "mobile", provider: "worker", providerUsd: 0.16, infraUsd: 0.035, creditKind: "action", creditCost: 52 },
  { id: "store_metadata_ai", category: "mobile", provider: "gpt-4o-mini", providerUsd: 0.014, infraUsd: 0.003, creditKind: "action", creditCost: 4 },
  { id: "integration_test", category: "integration", provider: "api-ping", providerUsd: 0.001, infraUsd: 0.0005, creditKind: "action", creditCost: 1 },
  { id: "runtime_llm_small", category: "runtime", provider: "gpt-4o-mini", providerUsd: 0.007, infraUsd: 0.0015, creditKind: "action", creditCost: 2 },
  { id: "runtime_llm_standard", category: "runtime", provider: "standard", providerUsd: 0.022, infraUsd: 0.004, creditKind: "action", creditCost: 6 },
  { id: "webhook_processing", category: "runtime", provider: "edge", providerUsd: 0.001, infraUsd: 0.0005, creditKind: "action", creditCost: 1 },
  { id: "payment_event", category: "runtime", provider: "worker", providerUsd: 0.002, infraUsd: 0.001, creditKind: "action", creditCost: 1 },
  { id: "analytics_event", category: "runtime", provider: "db-write", providerUsd: 0.0005, infraUsd: 0.0002, creditKind: "action", creditCost: 1 },
  { id: "notification_broadcast", category: "runtime", provider: "worker", providerUsd: 0.003, infraUsd: 0.001, creditKind: "action", creditCost: 1 },
  { id: "email_send", category: "runtime", provider: "resend", providerUsd: 0.002, infraUsd: 0.0005, creditKind: "action", creditCost: 1 },
];

export function auditActionRow(row, revenuePerActionCredit = STARTER_ACTION_REVENUE_USD) {
  const totalCost = row.providerUsd + row.infraUsd;
  const revenue =
    row.creditKind === "build"
      ? row.creditCost * BUILD_REVENUE_USD_PER_CREDIT
      : row.creditCost * revenuePerActionCredit;
  const marginPct = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 100;
  const mult = totalCost > 0 ? revenue / totalCost : 99;
  const pass = totalCost <= 0 || mult >= 5;
  return { ...row, totalCost, revenue, marginPct, mult, pass };
}

export function auditAllActions(revenuePerActionCredit = STARTER_ACTION_REVENUE_USD) {
  return ACTION_CATALOG.map((r) => auditActionRow(r, revenuePerActionCredit));
}

export function compareActionCatalogs(revenuePerActionCredit = STARTER_ACTION_REVENUE_USD) {
  const byId = Object.fromEntries(ACTION_CATALOG_BASELINE.map((r) => [r.id, r]));
  return ACTION_CATALOG.map((opt) => {
    const base = byId[opt.id];
    const b = base ? auditActionRow(base, revenuePerActionCredit) : null;
    const o = auditActionRow(opt, revenuePerActionCredit);
    return {
      id: opt.id,
      category: opt.category,
      baseCost: b?.totalCost ?? 0,
      optCost: o.totalCost,
      baseCredits: base?.creditCost ?? opt.creditCost,
      optCredits: opt.creditCost,
      baseMargin: b?.marginPct ?? 0,
      optMargin: o.marginPct,
      baseMult: b?.mult ?? 0,
      optMult: o.mult,
    };
  });
}
