import { loadMobileRevenueCatPublicConfig } from "@/lib/mobile-billing/wrapper-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RevenueCatAuditStatus = "ready" | "warning" | "blocked";

export type RevenueCatAuditResult = {
  status: RevenueCatAuditStatus;
  score: number;
  checks: Array<{
    id: string;
    label: string;
    status: "pass" | "warning" | "fail";
    detail: string;
  }>;
  hasSubscriptionSignals: boolean;
  optedOut: boolean;
};

function detectSubscriptionSignals(files: Array<{ path: string; content: string }>): boolean {
  const combined = files.map((f) => f.content).join("\n").toLowerCase();
  return (
    /revenuecat|purchases\.configure|@revenuecat|in_app_purchase|subscription|premium_plan|paywall/i.test(
      combined,
    )
  );
}

export async function runRevenueCatAudit(input: {
  projectId: string;
  supabase: SupabaseClient;
  files: Array<{ path: string; content: string }>;
  storeDraft?: Record<string, unknown> | null;
}): Promise<RevenueCatAuditResult> {
  const optedOut = input.storeDraft?.revenuecat_not_used === true;
  const hasSubscriptionSignals = detectSubscriptionSignals(input.files);
  const rc = await loadMobileRevenueCatPublicConfig(input.projectId);

  const checks: RevenueCatAuditResult["checks"] = [];

  checks.push({
    id: "api_key",
    label: "RevenueCat public SDK key",
    status: rc.publicSdkKey ? "pass" : "fail",
    detail: rc.publicSdkKey ? "Public SDK key configured" : "Missing public SDK key in Payments",
  });

  checks.push({
    id: "entitlement",
    label: "Entitlement ID",
    status: rc.entitlementId ? "pass" : "fail",
    detail: rc.entitlementId ? `Entitlement: ${rc.entitlementId}` : "Map an entitlement in mobile billing",
  });

  checks.push({
    id: "offering",
    label: "Offering ID",
    status: rc.offeringId ? "pass" : "warning",
    detail: rc.offeringId ? `Offering: ${rc.offeringId}` : "Offering optional but recommended",
  });

  checks.push({
    id: "android_mapping",
    label: "Android package mapping",
    status: rc.packageName ? "pass" : "warning",
    detail: rc.packageName ?? "Set Android package name in mobile billing config",
  });

  checks.push({
    id: "ios_mapping",
    label: "iOS bundle mapping",
    status: rc.bundleId ? "pass" : "warning",
    detail: rc.bundleId ?? "Set iOS bundle ID in mobile billing config",
  });

  const pass = checks.filter((c) => c.status === "pass").length;
  const score = Math.round((pass / checks.length) * 100);

  if (optedOut) {
    return {
      status: "ready",
      score: 100,
      checks: [
        ...checks,
        {
          id: "opt_out",
          label: "No subscriptions",
          status: "pass",
          detail: "User confirmed the app does not use in-app subscriptions",
        },
      ],
      hasSubscriptionSignals,
      optedOut: true,
    };
  }

  if (rc.enabled) {
    return {
      status: score >= 60 ? "ready" : "warning",
      score,
      checks,
      hasSubscriptionSignals,
      optedOut: false,
    };
  }

  if (hasSubscriptionSignals) {
    return {
      status: "blocked",
      score,
      checks: [
        ...checks,
        {
          id: "subscription_detected",
          label: "Subscription code detected",
          status: "fail",
          detail: "App source references subscriptions but RevenueCat is not configured",
        },
      ],
      hasSubscriptionSignals: true,
      optedOut: false,
    };
  }

  return {
    status: "warning",
    score,
    checks,
    hasSubscriptionSignals: false,
    optedOut: false,
  };
}
