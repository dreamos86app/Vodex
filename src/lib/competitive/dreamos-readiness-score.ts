import {
  COMPETITIVE_CATEGORIES,
  type CompetitiveCategoryDef,
  type CompetitiveCategoryId,
} from "@/lib/competitive/score-categories";
import {
  fileExists,
  hasBenchmarkPass,
  hasFullBenchmarkPass,
  hasLiveE2eProof,
  type EvidenceArtifact,
} from "@/lib/competitive/benchmark-evidence";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ScoredCategory = CompetitiveCategoryDef & {
  dreamosScore: number;
  cappedScore: number;
  riskLevel: RiskLevel;
  blockers: string[];
  hasE2eProof: boolean;
  hasVerifyProof: boolean;
  hasStubRisk: boolean;
  proofArtifact: string | null;
  winner: "dreamos" | "lovable" | "base44" | "tie";
};

/** Categories scored with evidence tiers (85 / 90 / 95 / 100). */
const EVIDENCE_TIER_CATEGORY_IDS = new Set<CompetitiveCategoryId>([
  "prompt_app_creation",
  "create_workflow_ui",
  "style_presets",
  "generated_ui_quality",
  "preview_system",
  "publish_system",
  "app_dashboard",
  "end_user_trust",
  "overall_polish",
  "real_production_readiness",
  "error_handling",
  "production_safety",
]);

const BENCHMARK_RELEVANT_IDS = new Set<CompetitiveCategoryId>([
  "generated_ui_quality",
  "backend_generation_quality",
  "real_production_readiness",
]);

function hasStubRisk(def: CompetitiveCategoryDef): boolean {
  return def.evidencePaths.some((p) => !fileExists(p));
}

function e2eProof(def: CompetitiveCategoryDef, artifact: EvidenceArtifact): boolean {
  if (!def.e2eSpec) return false;
  if (!hasLiveE2eProof(artifact)) return false;
  return fileExists(def.e2eSpec);
}

function verifyProof(def: CompetitiveCategoryDef): boolean {
  return def.evidencePaths.every((p) => fileExists(p));
}

function evidenceTierMax(
  def: CompetitiveCategoryDef,
  artifact: EvidenceArtifact,
): { max: number; reason: string | null } {
  const liveE2e = hasLiveE2eProof(artifact);
  const benchmark = hasBenchmarkPass(artifact);
  const needsBenchmark = BENCHMARK_RELEVANT_IDS.has(def.id);
  const failureCoverage = artifact.failureCoverage === true;
  const artifactExists = fileExists(".dreamos-evidence.json");
  const userFlowCategory = EVIDENCE_TIER_CATEGORY_IDS.has(def.id) || Boolean(def.e2eSpec);

  if (userFlowCategory && !liveE2e) {
    return { max: 85, reason: "No live E2E proof — cap 85" };
  }

  if (!EVIDENCE_TIER_CATEGORY_IDS.has(def.id) && !def.e2eSpec) {
    return { max: 100, reason: null };
  }

  if (!liveE2e) {
    return { max: 85, reason: "No live E2E proof — cap 85" };
  }
  if (needsBenchmark && !benchmark) {
    return { max: 90, reason: "Live E2E without benchmark pass — cap 90" };
  }
  if (!failureCoverage) {
    return { max: 95, reason: "No failure-state E2E coverage — cap 95" };
  }
  if (!artifactExists) {
    return { max: 95, reason: "Missing .dreamos-evidence.json — cap 95" };
  }
  return { max: 100, reason: null };
}

/** Apply scoring gates — never return 100 without proof. */
export function capDreamosScore(
  base: number,
  def: CompetitiveCategoryDef,
  artifact: EvidenceArtifact,
): { score: number; blockers: string[]; proofArtifact: string | null } {
  const blockers: string[] = [];
  let score = base;
  const stub = hasStubRisk(def);
  const e2e = e2eProof(def, artifact);
  const verify = verifyProof(def);

  if (stub) {
    score = Math.min(score, 50);
    blockers.push("Missing evidence files — stub risk (cap 50)");
  }
  if (!verify && def.e2eSpec) {
    score = Math.min(score, 70);
    blockers.push("Route exists but user flow not proven — cap 70");
  } else if (!verify) {
    score = Math.min(score, 75);
    blockers.push("Evidence paths not all present on disk");
  }

  const tier = evidenceTierMax(def, artifact);
  if (tier.reason) {
    score = Math.min(score, tier.max);
    blockers.push(tier.reason);
  } else if (def.e2eSpec && !e2e) {
    score = Math.min(score, 85);
    blockers.push("No live E2E proof — cap 85");
  }

  if (def.id === "generated_ui_quality") {
    const hasReview = fileExists("src/lib/generation/generated-ui-review.ts");
    const hasSpec = fileExists("src/lib/generation/ui-quality-spec.ts");
    const hasAppTypes = fileExists("src/lib/generation/app-type-ui-requirements.ts");
    const br = artifact.benchmarkReport;
    const smokeLive = br?.live === true && br?.smokePassed === true;
    const fullBench = hasFullBenchmarkPass(artifact);

    if (!hasReview || !hasSpec) {
      score = Math.min(score, 70);
      blockers.push("UI quality structure only — cap 70");
    } else if (!hasAppTypes) {
      score = Math.min(score, 70);
      blockers.push("App-type requirements missing — cap 70");
    } else if (!br) {
      score = Math.min(score, 85);
      blockers.push("Validator/review exists but no benchmark — cap 85");
    } else if (!br.live || br.mode === "structure_only" || br.mode === "not_run") {
      score = Math.min(score, 85);
      blockers.push("Benchmark not run live — cap 85");
    } else if (!smokeLive) {
      score = Math.min(score, 85);
      blockers.push("Live smoke not passed — cap 85");
    } else if (!fullBench) {
      score = Math.min(score, 90);
      blockers.push("Live smoke passed — cap 90 until 50-prompt benchmark");
    } else if (!artifact.failureCoverage) {
      score = Math.min(score, 95);
      blockers.push("50-prompt benchmark passed — cap 95 without failure coverage + visual QA");
    }

    if (br) {
      if ((br.placeholderRate ?? 1) > 0.05) {
        score = Math.min(score, 80);
        blockers.push("Placeholder rate >5%");
      }
      if ((br.buildSuccessRate ?? 0) < 0.9 && br.live) {
        score = Math.min(score, 85);
        blockers.push("Build success <90% on live benchmark");
      }
      if (smokeLive && (br.averageQualityScore ?? 0) >= 80) {
        const ceiling = fullBench && artifact.failureCoverage ? 95 : 90;
        score = Math.max(score, Math.min(ceiling, Math.round(br.averageQualityScore ?? score)));
      } else if ((br.averageQualityScore ?? 0) < 88 && br.live) {
        score = Math.min(score, 88);
        blockers.push("Average UI quality <88 on live benchmark");
      }
      if ((br.validatorFailMarkedGenerated ?? 0) > 0) {
        score = Math.min(score, 75);
        blockers.push("Apps marked generated when validator failed");
      }
    }
  }

  if (def.id === "preview_system" && artifact.previewRuntimeHonest === false) {
    score = Math.min(score, 85);
    blockers.push("Preview runtime honest fallback only — cap 85");
  }

  if (def.id === "real_production_readiness") {
    if (artifact.verifyPassed === true && hasLiveE2eProof(artifact) && hasBenchmarkPass(artifact)) {
      score = Math.max(score, artifact.failureCoverage ? 86 : 82);
    }
  }

  if (def.id === "testing_verify_coverage") {
    if (hasLiveE2eProof(artifact) && artifact.verifyPassed === true) {
      score = Math.max(score, 85);
    }
  }

  if (def.id === "overall_polish") {
    if (artifact.publicLandingHonest === true) {
      score = Math.max(score, Math.min(88, artifact.polishScoreAfter ?? 86));
    }
  }

  if (def.id === "end_user_trust") {
    if (artifact.publicLandingHonest === true && artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(88, artifact.endUserTrustScoreAfter ?? 86));
    }
  }

  if (def.id === "create_workflow_ui") {
    if (artifact.publicLandingHonest === true && hasLiveE2eProof(artifact)) {
      score = Math.max(score, Math.min(90, artifact.createWorkflowScoreAfter ?? 88));
    }
  }

  if (def.id === "mobile_responsiveness") {
    if (artifact.publicLandingHonest === true && hasLiveE2eProof(artifact)) {
      score = Math.max(score, Math.min(82, artifact.mobileScoreAfter ?? 80));
    }
  }

  if (def.id === "placeholder_prevention") {
    const br = artifact.benchmarkReport;
    if (br?.live && br.smokePassed && (br.placeholderRate ?? 1) <= 0.05) {
      score = Math.max(score, 85);
    }
  }

  if (def.id === "app_dashboard") {
    if (fileExists("src/lib/import/zip-import-service.ts") && fileExists("src/components/create/workspace/app-dashboard-panel.tsx")) {
      score = Math.max(score, 84);
    }
    if (fileExists("scripts/verify-zip-import.mjs")) {
      score = Math.max(score, 86);
    }
    if (fileExists("src/components/create/workspace/blueprint-summary-panel.tsx")) {
      score = Math.max(score, 87);
    }
    if (fileExists("tests/e2e/zip-import.spec.ts") && hasLiveE2eProof(artifact)) {
      score = Math.max(score, 88);
    }
    if (artifact.zipImportQualityScore != null && artifact.zipImportQualityScore >= 90) {
      score = Math.max(score, Math.min(92, 86 + Math.round((artifact.zipImportQualityScore - 90) / 2)));
    }
  }

  const paidUserSafetyIds = new Set<CompetitiveCategoryId>([
    "production_safety",
    "real_production_readiness",
    "end_user_trust",
    "auth_security_depth",
  ]);
  if (paidUserSafetyIds.has(def.id) && artifact.securityVerifyPassed !== true) {
    score = Math.min(score, 94);
    blockers.push("Security verify suite must pass for 95+ paid-user readiness");
  }

  if (def.id === "style_presets" && !fileExists("src/lib/create/style-presets.ts")) {
    score = Math.min(score, 60);
    blockers.push("Style presets not wired to generation");
  } else if (def.id === "style_presets") {
    if (fileExists("src/lib/create/style-presets.ts") && fileExists("src/lib/build/blueprint-deterministic.ts")) {
      score = Math.max(score, 78);
    }
    const br = artifact.benchmarkReport;
    if (br?.averageBlueprintScore != null && br.averageBlueprintScore >= 80) {
      score = Math.max(score, 82);
    }
    if (verify && fileExists("scripts/verify-blueprint-depth.ts")) {
      score = Math.max(score, 84);
    }
  }

  if (def.id === "blueprint_quality") {
    const hasArchetypes = fileExists("src/lib/build/blueprint-archetypes.ts");
    const hasScoring = fileExists("src/lib/build/blueprint-scoring.ts");
    const br = artifact.benchmarkReport;
    if (hasArchetypes && hasScoring && verify) {
      score = Math.max(score, 84);
    }
    if (br?.averageBlueprintScore != null && br.averageBlueprintScore >= 80) {
      score = Math.max(score, Math.min(88, Math.round(br.averageBlueprintScore)));
    }
    if (br?.averageBlueprintScore != null && br.averageBlueprintScore >= 85) {
      score = Math.max(score, Math.min(90, Math.round(br.averageBlueprintScore)));
    }
    if (hasFullBenchmarkPass(artifact) && (br?.averageBlueprintScore ?? 0) >= 85) {
      score = Math.max(score, Math.min(95, Math.round(br?.averageBlueprintScore ?? score)));
    } else if (!hasFullBenchmarkPass(artifact) && (br?.averageBlueprintScore ?? 0) >= 83) {
      score = Math.max(score, 88);
      blockers.push("Blueprint half-benchmark ≥83 — full 50-prompt live build pending for 95+");
    } else if (!hasFullBenchmarkPass(artifact)) {
      score = Math.min(score, 90);
      if ((br?.averageBlueprintScore ?? 0) < 83) {
        blockers.push("Blueprint score capped until 50-prompt avg ≥83");
      }
    }
  }

  if (def.id === "template_system") {
    const hasArchetypes = fileExists("src/lib/templates/template-archetypes.ts");
    const hasDataModels = fileExists("src/lib/templates/template-data-models.ts");
    if (hasArchetypes && hasDataModels && verify) {
      score = Math.max(score, 82);
    }
    if (artifact.benchmarkReport?.templateInfluenceRate != null) {
      if (artifact.benchmarkReport.templateInfluenceRate >= 0.9) {
        score = Math.max(score, 86);
      } else {
        score = Math.min(score, 82);
        blockers.push("Template influence <90% on benchmark");
      }
    }
    if (artifact.benchmarkReport?.templateInfluenceRate === 1) {
      score = Math.max(score, 88);
    }
    if (hasFullBenchmarkPass(artifact)) {
      score = Math.max(score, 90);
    }
  }

  if (def.id === "backend_generation_quality") {
    if (fileExists("src/lib/build/backend-plan.ts") && verify) {
      score = Math.max(score, 82);
    }
    const br = artifact.benchmarkReport;
    if (br?.backendPlanCompleteness != null && br.backendPlanCompleteness >= 0.8) {
      score = Math.max(score, Math.min(88, Math.round(80 + br.backendPlanCompleteness * 10)));
    }
    if (br?.backendPlanCompleteness === 1) {
      score = Math.max(score, 86);
    }
    if (hasFullBenchmarkPass(artifact) && (br?.backendPlanCompleteness ?? 0) >= 0.8) {
      score = Math.max(score, 90);
    }
  }

  if (def.id === "database_supabase_depth") {
    if (fileExists("src/lib/build/database-depth-plan.ts") && verify) {
      score = Math.max(score, 82);
    }
    const br = artifact.benchmarkReport;
    if (br?.backendPlanCompleteness != null && br.backendPlanCompleteness >= 0.8) {
      score = Math.max(score, 84);
    }
    if (hasFullBenchmarkPass(artifact)) {
      score = Math.max(score, 86);
    }
  }

  if (def.id === "multi_model_routing") {
    if (fileExists("src/lib/ai/route-decision-log.ts") && verify) {
      score = Math.max(score, 82);
    }
    if (artifact.benchmarkReport?.routeDecisionsLogged === true) {
      score = Math.max(score, 85);
    }
  }

  const proofParts: string[] = [];
  if (e2e || hasLiveE2eProof(artifact)) proofParts.push("e2e-live");
  if (verify) proofParts.push("verify");
  if (artifact.benchmarkReport?.live && def.id === "generated_ui_quality") proofParts.push("benchmark");
  if (artifact.failureCoverage) proofParts.push("failure-coverage");

  const proofArtifact: string | null = proofParts.length ? proofParts.join("+") : null;

  if (score >= 100) {
    const can100 =
      hasLiveE2eProof(artifact) &&
      proofArtifact &&
      !stub &&
      (!BENCHMARK_RELEVANT_IDS.has(def.id) || hasBenchmarkPass(artifact)) &&
      artifact.failureCoverage === true;
    if (!can100) {
      score = Math.min(score, 99);
      blockers.push("Cannot score 100 without live E2E + benchmark (if relevant) + failure coverage + evidence artifact");
    }
  }

  return { score: Math.min(100, Math.round(score)), blockers, proofArtifact };
}

function riskFromScore(score: number, blockers: string[]): RiskLevel {
  if (blockers.some((b) => b.includes("stub"))) return "critical";
  if (score < 60) return "high";
  if (score < 75) return "medium";
  return "low";
}

export function scoreAllCategories(artifact: EvidenceArtifact = {}): ScoredCategory[] {
  return COMPETITIVE_CATEGORIES.map((def) => {
    const { score, blockers, proofArtifact } = capDreamosScore(def.dreamosBaseScore, def, artifact);
    const e2e = e2eProof(def, artifact);
    const verify = verifyProof(def);
    const stub = hasStubRisk(def);
    const d = score;
    const l = def.lovableScore;
    const b = def.base44Score;
    let winner: ScoredCategory["winner"] = "tie";
    if (d > l && d > b) winner = "dreamos";
    else if (l > d && l >= b) winner = "lovable";
    else if (b > d && b >= l) winner = "base44";

    return {
      ...def,
      dreamosScore: def.dreamosBaseScore,
      cappedScore: score,
      riskLevel: riskFromScore(score, blockers),
      blockers,
      hasE2eProof: e2e,
      hasVerifyProof: verify,
      hasStubRisk: stub,
      proofArtifact,
      winner,
    };
  });
}

export function aggregateScores(scored: ScoredCategory[]) {
  const dreamos = Math.round(scored.reduce((s, c) => s + c.cappedScore, 0) / scored.length);
  const lovable = Math.round(scored.reduce((s, c) => s + c.lovableScore, 0) / scored.length);
  const base44 = Math.round(scored.reduce((s, c) => s + c.base44Score, 0) / scored.length);
  const dreamosWins = scored.filter((c) => c.winner === "dreamos").length;
  return { dreamos, lovable, base44, dreamosWins, total: scored.length };
}

export function categoriesBelow(threshold: number, scored: ScoredCategory[]): ScoredCategory[] {
  return scored.filter((c) => c.cappedScore < threshold).sort((a, b) => a.cappedScore - b.cappedScore);
}
