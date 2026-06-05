import "server-only";

import { loadCertificationContext, detectAppSourceKind } from "@/lib/certification/load-context";
import { runAppAuditChecks, runSecurityChecks } from "@/lib/certification/checks/app-audit";
import { runAuthCertificationChecks } from "@/lib/certification/checks/auth";
import { runIntegrationCertificationChecks } from "@/lib/certification/checks/integrations";
import { runPaymentCertificationChecks } from "@/lib/certification/checks/payments";
import { runPublishCertificationChecks } from "@/lib/certification/checks/publish";
import { runMobileCertificationChecks } from "@/lib/certification/checks/mobile";
import { runDataCertificationChecks } from "@/lib/certification/checks/data";
import { runDashboardCertificationChecks } from "@/lib/certification/checks/dashboard";
import { runPlatformCertificationChecks } from "@/lib/certification/checks/platform";
import {
  aggregateChecks,
  buildRecommendations,
  scoreSection,
} from "@/lib/certification/scoring";
import { buildAutoFixSuggestions } from "@/lib/certification/auto-fix";
import { buildLaunchChecklist } from "@/lib/certification/launch-checklist";
import type {
  CertificationSectionReport,
  ProductionCertificationResult,
} from "@/lib/certification/types";

const SECTION_LABELS: Record<string, string> = {
  security: "Security",
  auth: "Authentication",
  integrations: "Integrations",
  payments: "Payments",
  publish: "Publishing",
  mobile: "Mobile",
  performance: "Performance",
  data: "Data",
  dashboard: "Dashboard",
  app_audit: "App audit",
  platform: "Platform",
};

function groupSections(
  checks: Awaited<ReturnType<typeof runAuthCertificationChecks>>,
): CertificationSectionReport[] {
  const byId = new Map<string, typeof checks>();
  for (const c of checks) {
    const list = byId.get(c.section) ?? [];
    list.push(c);
    byId.set(c.section, list);
  }
  return [...byId.entries()].map(([id, sectionChecks]) => {
    const passed = sectionChecks.filter((c) => c.status === "passed").length;
    const warnings = sectionChecks.filter((c) => c.status === "warning").length;
    const blockers = sectionChecks.filter((c) => c.status === "blocker").length;
    return {
      id: id as CertificationSectionReport["id"],
      label: SECTION_LABELS[id] ?? id,
      score: scoreSection(sectionChecks),
      checks: sectionChecks,
      passed,
      warnings,
      blockers,
    };
  });
}

export async function runProductionCertification(input: {
  projectId: string;
  ownerId: string;
  includePlatform?: boolean;
}): Promise<ProductionCertificationResult | { error: string }> {
  const started = Date.now();
  const ctx = await loadCertificationContext(input.projectId, input.ownerId);
  if (!ctx) return { error: "Project not found" };

  const allChecks = [
    ...runSecurityChecks(ctx),
    ...runAppAuditChecks(ctx),
    ...(await runAuthCertificationChecks(ctx)),
    ...(await runIntegrationCertificationChecks(ctx)),
    ...(await runPaymentCertificationChecks(ctx)),
    ...runPublishCertificationChecks(ctx),
    ...(await runMobileCertificationChecks(ctx)),
    ...(await runDataCertificationChecks(ctx)),
    ...(await runDashboardCertificationChecks(ctx)),
  ];

  if (input.includePlatform) {
    allChecks.push(...(await runPlatformCertificationChecks()));
  }

  const sections = groupSections(allChecks);
  const agg = aggregateChecks(sections);
  const recommendations = buildRecommendations(sections);
  const auto_fix_suggestions = buildAutoFixSuggestions(sections);
  const launch_checklist = buildLaunchChecklist(sections);

  return {
    overall_score: agg.overall_score,
    certification_level: agg.certification_level,
    passed_checks: agg.passed_checks,
    warnings: agg.warnings,
    blockers: agg.blockers,
    recommendations,
    sections,
    launch_checklist,
    auto_fix_suggestions,
    report: {
      generated_at: new Date().toISOString(),
      project_id: input.projectId,
      app_name: ctx.projectName,
      published: ctx.published,
      source_kind: detectAppSourceKind(ctx.metadata),
      duration_ms: Date.now() - started,
    },
  };
}
