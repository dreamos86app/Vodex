import type {
  CertificationCheck,
  CertificationLevel,
  CertificationSectionReport,
} from "@/lib/certification/types";

const CRITICAL_SECTIONS = new Set(["security", "auth", "publish"]);

export function scoreSection(checks: CertificationCheck[]): number {
  if (!checks.length) return 100;
  let earned = 0;
  let total = 0;
  for (const c of checks) {
    total += c.weight;
    if (c.status === "passed") earned += c.weight;
    else if (c.status === "warning") earned += c.weight * 0.5;
  }
  return total ? Math.round((earned / total) * 100) : 100;
}

export function aggregateChecks(sections: CertificationSectionReport[]): {
  passed_checks: number;
  warnings: number;
  blockers: number;
  overall_score: number;
  certification_level: CertificationLevel;
} {
  let passed = 0;
  let warnings = 0;
  let blockers = 0;
  let weighted = 0;
  let weightTotal = 0;

  for (const section of sections) {
    for (const c of section.checks) {
      if (c.status === "passed") passed += 1;
      if (c.status === "warning") warnings += 1;
      if (c.status === "blocker") blockers += 1;
      weightTotal += c.weight;
      if (c.status === "passed") weighted += c.weight;
      else if (c.status === "warning") weighted += c.weight * 0.5;
    }
  }

  let overall_score = weightTotal ? Math.round((weighted / weightTotal) * 100) : 0;

  const criticalBlockers = sections.some(
    (s) => CRITICAL_SECTIONS.has(s.id) && s.blockers > 0,
  );
  if (blockers > 0) {
    overall_score = Math.min(overall_score, criticalBlockers ? 39 : 59);
  }

  let certification_level: CertificationLevel = "NOT_READY";
  if (blockers > 0 || overall_score < 40) certification_level = "NOT_READY";
  else if (overall_score < 60) certification_level = "BASIC";
  else if (overall_score < 75) certification_level = "BETA_READY";
  else if (overall_score < 90) certification_level = "PRODUCTION_READY";
  else certification_level = "ENTERPRISE_READY";

  if (blockers > 0 && certification_level !== "NOT_READY") {
    certification_level = criticalBlockers ? "NOT_READY" : "BASIC";
  }

  return {
    passed_checks: passed,
    warnings,
    blockers,
    overall_score,
    certification_level,
  };
}

export function buildRecommendations(sections: CertificationSectionReport[]): string[] {
  const out: string[] = [];
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.status === "blocker" && c.fix) out.push(c.fix);
      else if (c.status === "warning" && c.fix) out.push(c.fix);
    }
  }
  return [...new Set(out)].slice(0, 12);
}
