import {
  buildEligibilityReport,
  type EligibilityFinding,
  type EligibilityReport,
} from "@/lib/mobile/eligibility-report";
import type { MobileAppConfig } from "@/lib/mobile/types";
import { runRevenueCatAudit, type RevenueCatAuditResult } from "@/lib/mobile/revenuecat-audit";

export type ReadinessSeverity = "critical" | "high" | "medium" | "low";

export type ReadinessEngineFinding = EligibilityFinding & {
  severity: ReadinessSeverity;
};

export type ReadinessEngineReport = {
  score: number;
  critical: ReadinessEngineFinding[];
  high: ReadinessEngineFinding[];
  medium: ReadinessEngineFinding[];
  low: ReadinessEngineFinding[];
  gatePassed: boolean;
  revenueCat: RevenueCatAuditResult;
  eligibility: EligibilityReport;
  generatedAt: string;
  summary: string;
};

function tierToSeverity(tier: EligibilityFinding["tier"]): ReadinessSeverity {
  if (tier === "critical") return "critical";
  if (tier === "warning") return "high";
  return "low";
}

function scoreFromFindings(findings: ReadinessEngineFinding[]): number {
  if (findings.length === 0) return 100;
  let penalty = 0;
  for (const f of findings) {
    if (f.severity === "critical") penalty += 25;
    else if (f.severity === "high") penalty += 10;
    else if (f.severity === "medium") penalty += 4;
    else penalty += 1;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

export async function runAppReadinessEngine(input: {
  projectId: string;
  supabase: Parameters<typeof runRevenueCatAudit>[0]["supabase"];
  config: Partial<MobileAppConfig>;
  fileCount: number;
  hasPreview: boolean;
  appName?: string | null;
  description?: string | null;
  files: Array<{ path: string; content: string }>;
  androidCtx: Parameters<typeof buildEligibilityReport>[0]["androidCtx"];
  iosCtx: Parameters<typeof buildEligibilityReport>[0]["iosCtx"];
  revenueCatConfigured: boolean;
  revenueCatOptedOut: boolean;
}): Promise<ReadinessEngineReport> {
  const eligibility = buildEligibilityReport({
    config: input.config,
    fileCount: input.fileCount,
    hasPreview: input.hasPreview,
    appName: input.appName,
    description: input.description,
    files: input.files,
    androidCtx: input.androidCtx,
    iosCtx: input.iosCtx,
    revenueCatConfigured: input.revenueCatConfigured,
    revenueCatOptedOut: input.revenueCatOptedOut,
  });

  const revenueCat = await runRevenueCatAudit({
    projectId: input.projectId,
    supabase: input.supabase,
    files: input.files,
    storeDraft:
      input.config.store_draft && typeof input.config.store_draft === "object"
        ? (input.config.store_draft as Record<string, unknown>)
        : null,
  });

  const all: ReadinessEngineFinding[] = [
    ...eligibility.critical.map((f) => ({ ...f, severity: "critical" as const })),
    ...eligibility.warnings.map((f) => ({ ...f, severity: tierToSeverity("warning") })),
    ...eligibility.recommendations.map((f) => ({ ...f, severity: "low" as const })),
  ];

  if (revenueCat.status === "blocked") {
    all.push({
      id: "revenuecat_blocked",
      tier: "critical",
      severity: "critical",
      label: "RevenueCat audit blocked",
      detail: "Subscription features detected without RevenueCat configuration",
      platform: "general",
      category: "billing",
    });
  }

  const critical = all.filter((f) => f.severity === "critical");
  const high = all.filter((f) => f.severity === "high");
  const medium = all.filter((f) => f.severity === "medium");
  const low = all.filter((f) => f.severity === "low");

  const score = scoreFromFindings(all);
  const gatePassed =
    critical.length === 0 &&
    revenueCat.status !== "blocked" &&
    eligibility.gatePassed &&
    input.fileCount > 0;

  return {
    score,
    critical,
    high,
    medium,
    low,
    gatePassed,
    revenueCat,
    eligibility,
    generatedAt: new Date().toISOString(),
    summary:
      critical.length > 0
        ? `${critical.length} critical issue(s) block publishing`
        : gatePassed
          ? `Ready for mobile packaging (score ${score}/100)`
          : `Review ${high.length} high-priority item(s) before packaging`,
  };
}
