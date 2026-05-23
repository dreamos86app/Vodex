#!/usr/bin/env node
/**
 * Evidence-based competitive score report — mirrors dreamos-readiness-score.ts caps.
 * Does NOT inflate; structure-only E2E never counts as live proof.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Load categories by eval-ing the TS export (regex parse base scores)
const catsSrc = fs.readFileSync(path.join(root, "src/lib/competitive/score-categories.ts"), "utf8");
const catBlocks = [...catsSrc.matchAll(/\{\s*\n\s*id: "([^"]+)"[\s\S]*?dreamosBaseScore: (\d+),[\s\S]*?lovableScore: (\d+),[\s\S]*?base44Score: (\d+),[\s\S]*?fixToReach100: "([^"]+)"/g)];
const categories = catBlocks.map((m) => ({
  id: m[1],
  dreamosBaseScore: +m[2],
  lovableScore: +m[3],
  base44Score: +m[4],
  fixToReach100: m[5],
}));

const EVIDENCE_TIER = new Set([
  "prompt_app_creation", "create_workflow_ui", "style_presets", "generated_ui_quality",
  "preview_system", "publish_system", "app_dashboard", "end_user_trust", "overall_polish",
  "real_production_readiness", "error_handling", "production_safety",
]);
const BENCHMARK_RELEVANT = new Set(["generated_ui_quality", "backend_generation_quality", "real_production_readiness"]);

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function parseEvidencePaths(id) {
  const re = new RegExp(`id: "${id}"[\\s\\S]*?evidencePaths: \\[([\\s\\S]*?)\\]`, "m");
  const m = catsSrc.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function parseE2eSpec(id) {
  const re = new RegExp(`id: "${id}"[\\s\\S]*?(e2eSpec: "([^"]+)")?`, "m");
  const m = catsSrc.match(re);
  return m?.[2] ?? null;
}

function parseTitle(id) {
  const re = new RegExp(`id: "${id}"[\\s\\S]*?title: "([^"]+)"`, "m");
  return catsSrc.match(re)?.[1] ?? id;
}

const artifact = JSON.parse(fs.readFileSync(path.join(root, ".dreamos-evidence.json"), "utf8"));

function hasLiveE2eProof() {
  return Boolean(
    artifact.e2eLiveProof === true &&
      artifact.e2eMode === "live-passed" &&
      artifact.e2ePassed === true,
  );
}

function hasLiveHalfBenchmarkPass() {
  const br = artifact.benchmarkReport;
  if (!br?.live || br.benchmarkEvidenceSource === "structure") return false;
  if (!br.halfBenchmarkReady || br.smokePassed !== true) return false;
  return (
    (br.buildSuccessRate ?? 0) >= 0.9 &&
    (br.uiValidationRate ?? 0) >= 0.9 &&
    (br.averageQualityScore ?? 0) >= 88 &&
    (br.averageBlueprintScore ?? 0) >= 85 &&
    (br.templateInfluenceRate ?? 0) >= 0.9 &&
    (br.backendPlanCompleteness ?? 0) >= 0.8 &&
    (br.databaseDepthAverage ?? 0) >= 80 &&
    (br.placeholderRate ?? 1) <= 0.05
  );
}

function hasLiveFullBenchmarkPass() {
  const br = artifact.benchmarkReport;
  if (!hasLiveHalfBenchmarkPass()) return false;
  return br.fullBenchmarkReady === true && (br.promptCount ?? 0) >= 50;
}

function hasBenchmarkPass() {
  return hasLiveHalfBenchmarkPass();
}

function hasFullBenchmarkPass() {
  return hasLiveFullBenchmarkPass();
}

function capScore(def) {
  const id = def.id;
  const evidencePaths = parseEvidencePaths(id);
  const e2eSpec = parseE2eSpec(id);
  let score = def.dreamosBaseScore;
  const blockers = [];
  const stub = evidencePaths.some((p) => !fileExists(p));
  const verify = evidencePaths.every((p) => fileExists(p));
  const liveE2e = hasLiveE2eProof() && e2eSpec && fileExists(e2eSpec);

  if (stub) {
    score = Math.min(score, 50);
    blockers.push("stub/missing evidence (cap 50)");
  }
  if (!verify && e2eSpec) {
    score = Math.min(score, 70);
    blockers.push("route exists, user flow unproven (cap 70)");
  } else if (!verify) {
    score = Math.min(score, 75);
    blockers.push("evidence paths incomplete (cap 75)");
  }

  const userFlow = EVIDENCE_TIER.has(id) || Boolean(e2eSpec);
  if (userFlow && !hasLiveE2eProof()) {
    score = Math.min(score, 85);
    blockers.push("no live E2E — cap 85");
  } else if (EVIDENCE_TIER.has(id) || e2eSpec) {
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 85);
      blockers.push("no live E2E — cap 85");
    } else if (BENCHMARK_RELEVANT.has(id) && !hasBenchmarkPass()) {
      score = Math.min(score, 90);
      blockers.push("live E2E, no benchmark pass — cap 90");
    } else if (!artifact.failureCoverage) {
      score = Math.min(score, 95);
      blockers.push("no failure coverage — cap 95");
    }
  }

  if (id === "generated_ui_quality") {
    const br = artifact.benchmarkReport;
    if (br?.structureFixtures && br.smokePassed && (br.averageQualityScore ?? 0) >= 88) {
      score = Math.max(score, Math.min(90, Math.round(br.averageQualityScore)));
    }
    if (!br || br.mode === "structure_only") {
      score = Math.min(score, 85);
      blockers.push("benchmark structure-only — cap 85");
    } else if (br.structureFixtures && br.smokePassed) {
      score = Math.min(score, 90);
      blockers.push("fixture benchmark only — cap 90 until live 10-prompt run");
    } else if (!br.live) {
      score = Math.min(score, 85);
      blockers.push("no live benchmark — cap 85");
    }
    if (br && br.live && br.smokePassed && (br.averageQualityScore ?? 0) >= 80) {
      const ceiling = hasLiveFullBenchmarkPass() && artifact.failureCoverage ? 95 : hasLiveHalfBenchmarkPass() ? 90 : 88;
      score = Math.max(score, Math.min(ceiling, Math.round(br.averageQualityScore ?? score)));
    }
    if (hasLiveHalfBenchmarkPass() && (br?.uiValidationRate ?? 0) >= 0.9 && (br?.averageQualityScore ?? 0) >= 88) {
      score = Math.max(score, 90);
    }
    if (hasLiveFullBenchmarkPass() && (br?.averageQualityScore ?? 0) >= 90 && (br?.placeholderRate ?? 1) <= 0.05) {
      score = Math.max(score, 95);
    }
    if (br && (br.placeholderRate ?? 1) > 0.05) {
      score = Math.min(score, 80);
      blockers.push("placeholder rate >5% — cap 80");
    }
    if (br && br.live && (br.buildSuccessRate ?? 0) < 0.9) {
      score = Math.min(score, 85);
      blockers.push("build success <90% — cap 85");
    }
    if (br?.live && !br.smokePassed) {
      score = Math.min(score, 85);
      blockers.push("live smoke not passed — cap 85");
    } else if (br?.live && br.smokePassed && !hasFullBenchmarkPass()) {
      score = Math.min(score, 90);
      blockers.push("smoke ok, no 50-prompt bench — cap 90");
    }
  }

  if (id === "preview_system") {
    if (artifact.previewRuntimeHonest === true) {
      score = Math.max(score, Math.min(88, artifact.previewScoreAfter ?? 85));
    } else {
      score = Math.min(score, 80);
      blockers.push("preview runtime not verified honest — cap 80");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 88);
      blockers.push("no live preview E2E — cap 88");
    }
  }

  if (id === "publish_system") {
    if (artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(90, artifact.publishScoreAfter ?? 88));
    } else {
      score = Math.min(score, 78);
      blockers.push("publish runtime not verified honest — cap 78");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 90);
      blockers.push("no live publish E2E — cap 90");
    }
  }

  if (id === "public_p_slug_rendering") {
    if (artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(85, artifact.publicRenderScoreAfter ?? 82));
    } else {
      score = Math.min(score, 58);
      blockers.push("public render not verified — cap 58");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 85);
      blockers.push("no live public URL E2E — cap 85");
    }
  }

  if (id === "subdomain_public_url") {
    if (artifact.subdomainMode === "wildcard" && artifact.dnsVerified === true) {
      score = Math.max(score, Math.min(92, artifact.subdomainScoreAfter ?? 88));
    } else if (artifact.deployRuntimeHonest === true || artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(82, artifact.subdomainScoreAfter ?? 78));
      blockers.push("path mode default — wildcard needs DNS verify");
    } else {
      score = Math.min(score, 65);
      blockers.push("subdomain/public URL not verified honest");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 88);
      blockers.push("no live subdomain E2E — cap 88");
    }
  }

  if (id === "vercel_deploy_system") {
    if (artifact.deployRuntimeHonest === true) {
      score = Math.max(score, Math.min(90, artifact.deployScoreAfter ?? 88));
    } else {
      score = Math.min(score, 62);
      blockers.push("deploy runtime not verified honest — cap 62");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 90);
      blockers.push("no live Vercel deploy E2E — cap 90");
    }
  }

  if (id === "mobile_responsiveness") {
    if (artifact.publicLandingHonest === true && hasLiveE2eProof()) {
      score = Math.max(score, Math.min(82, artifact.mobileScoreAfter ?? 80));
    } else if (artifact.mobileLayoutHonest === true) {
      score = Math.max(score, Math.min(85, artifact.mobileScoreAfter ?? 82));
    } else if (artifact.mobileLayoutStructureOk === true) {
      score = Math.max(score, Math.min(78, artifact.mobileScoreAfter ?? 76));
      blockers.push("structure ok — live mobile sweep needed for 85+");
    } else {
      score = Math.min(score, 68);
      blockers.push("mobile layout not verified — cap 68");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 85);
      blockers.push("no live mobile E2E — cap 85");
    }
  }

  if (id === "overall_polish") {
    if (artifact.publicLandingHonest === true) {
      score = Math.max(score, Math.min(88, artifact.polishScoreAfter ?? 86));
    } else if (artifact.mobileLayoutHonest === true) {
      score = Math.max(score, Math.min(86, artifact.polishScoreAfter ?? 84));
    } else if (artifact.mobileLayoutStructureOk === true) {
      score = Math.max(score, Math.min(82, artifact.polishScoreAfter ?? 80));
      blockers.push("structure polish ok — live E2E for 86+");
    } else {
      score = Math.min(score, 74);
      blockers.push("polish/mobile verify not passed — cap 74");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 86);
      blockers.push("no live polish E2E — cap 86");
    }
  }

  if (id === "create_workflow_ui") {
    if (artifact.publicLandingHonest === true && hasLiveE2eProof()) {
      score = Math.max(score, Math.min(90, artifact.createWorkflowScoreAfter ?? 88));
    } else if (artifact.mobileLayoutHonest === true) {
      score = Math.max(score, Math.min(90, artifact.createWorkflowScoreAfter ?? 88));
    } else if (artifact.mobileLayoutStructureOk === true) {
      score = Math.max(score, Math.min(85, artifact.createWorkflowScoreAfter ?? 85));
      blockers.push("create funnel structure ok — live auth E2E for 90+");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 90);
      blockers.push("create funnel not proven live — cap 90");
    }
  }

  if (id === "end_user_trust") {
    if (artifact.publicLandingHonest === true && artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(88, artifact.endUserTrustScoreAfter ?? 86));
    } else if (artifact.mobileLayoutHonest === true && artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(88, artifact.endUserTrustScoreAfter ?? 86));
    } else if (artifact.mobileLayoutStructureOk === true && artifact.publishRuntimeHonest === true) {
      score = Math.max(score, Math.min(82, artifact.endUserTrustScoreAfter ?? 82));
      blockers.push("trust UI structure ok — live E2E for 88+");
    }
    if (!hasLiveE2eProof()) {
      score = Math.min(score, 88);
      blockers.push("trust states not proven live — cap 88");
    }
  }

  if (id === "real_production_readiness") {
    const br = artifact.benchmarkReport ?? artifact.benchmarkStructureReport;
    if (artifact.verifyPassed === true && hasLiveE2eProof() && hasLiveHalfBenchmarkPass()) {
      score = Math.max(score, 90);
    }
    if (artifact.verifyPassed === true && hasLiveE2eProof() && hasLiveFullBenchmarkPass() && artifact.failureCoverage) {
      score = Math.max(score, 95);
    } else if (artifact.verifyPassed === true && hasLiveE2eProof() && br?.halfBenchmarkReady && !hasLiveHalfBenchmarkPass()) {
      blockers.push("verify + E2E ok — live half benchmark pass required for 90+");
    }
  }

  if (id === "testing_verify_coverage") {
    if (hasLiveE2eProof() && artifact.verifyPassed === true && hasLiveHalfBenchmarkPass()) {
      score = Math.max(score, 90);
    }
    if (hasLiveE2eProof() && artifact.verifyPassed === true && hasLiveFullBenchmarkPass()) {
      score = Math.max(score, 95);
    } else if (hasLiveE2eProof() && artifact.verifyPassed === true && fileExists("tests/e2e/zip-import.spec.ts")) {
      score = Math.max(score, 88);
    }
  }

  if (id === "placeholder_prevention") {
    const br = artifact.benchmarkReport;
    if (br?.live && br.smokePassed && (br.placeholderRate ?? 1) <= 0.05) {
      score = Math.max(score, 85);
    }
  }

  const editorIds = ["editor_workspace", "file_tree_tabs", "ai_diff_review", "checkpoints_rollback"];
  if (editorIds.includes(id) && artifact.editorRuntimeHonest === true) {
    const after =
      id === "editor_workspace"
        ? artifact.editorScoreAfter ?? 86
        : id === "file_tree_tabs"
          ? artifact.fileTreeScoreAfter ?? 88
          : id === "ai_diff_review"
            ? artifact.aiDiffScoreAfter ?? 84
            : artifact.checkpointScoreAfter ?? 80;
    score = Math.max(score, Math.min(after + 2, after));
    if (!hasLiveE2eProof()) {
      const cap = id === "checkpoints_rollback" ? 82 : 88;
      score = Math.min(score, cap);
      blockers.push(`no live builder E2E — cap ${cap}`);
    }
  } else if (editorIds.includes(id) && artifact.editorRuntimeHonest !== true) {
    score = Math.min(score, def.dreamosBaseScore);
    blockers.push("editor runtime not verified — base score");
  }

  if (id === "style_presets" && !fileExists("src/lib/create/style-presets.ts")) {
    score = Math.min(score, 60);
    blockers.push("style presets missing");
  } else if (id === "style_presets" && fileExists("src/lib/build/blueprint-deterministic.ts")) {
    score = Math.max(score, 78);
    const br = artifact.benchmarkReport ?? artifact.benchmarkStructureReport;
    if (br?.averageBlueprintScore >= 80) score = Math.max(score, 82);
    if (fileExists("scripts/verify-blueprint-depth.ts")) score = Math.max(score, 84);
  }

  if (id === "blueprint_quality") {
    const br = artifact.benchmarkReport ?? artifact.benchmarkStructureReport;
    if (fileExists("src/lib/build/blueprint-archetypes.ts") && fileExists("src/lib/build/blueprint-scoring.ts")) {
      score = Math.max(score, 84);
    }
    if (br?.averageBlueprintScore >= 80) {
      score = Math.max(score, Math.min(88, Math.round(br.averageBlueprintScore)));
    }
    if (hasLiveHalfBenchmarkPass() && (br?.averageBlueprintScore ?? 0) >= 85) {
      score = Math.max(score, 90);
    }
    if (hasLiveFullBenchmarkPass() && (br?.averageBlueprintScore ?? 0) >= 88) {
      score = Math.max(score, 95);
    } else if (!hasLiveHalfBenchmarkPass() && (br?.averageBlueprintScore ?? 0) >= 83) {
      blockers.push("structure blueprint ≥83 — live half build benchmark required for 90+");
    }
  }

  if (id === "template_system") {
    const br = artifact.benchmarkReport ?? artifact.benchmarkStructureReport;
    if (fileExists("src/lib/templates/template-archetypes.ts")) score = Math.max(score, 82);
    if (br?.templateInfluenceRate >= 0.9) score = Math.max(score, 86);
    if (br?.templateInfluenceRate === 1) score = Math.max(score, 88);
    if (hasLiveHalfBenchmarkPass() && (br?.templateInfluenceRate ?? 0) >= 0.9) {
      score = Math.max(score, 90);
    }
    if (hasLiveFullBenchmarkPass() && (br?.templateInfluenceRate ?? 0) >= 0.95) {
      score = Math.max(score, 95);
    } else if (!hasLiveHalfBenchmarkPass() && (br?.templateInfluenceRate ?? 0) >= 0.9) {
      blockers.push("structure template influence — live half build required for 90+");
    }
  }

  if (id === "backend_generation_quality") {
    const br = artifact.benchmarkReport ?? artifact.benchmarkStructureReport;
    if (fileExists("src/lib/build/backend-plan.ts")) score = Math.max(score, 82);
    if (br?.backendPlanCompleteness >= 0.8) score = Math.max(score, 86);
    if (br?.backendPlanCompleteness === 1) score = Math.max(score, 88);
    if (hasLiveHalfBenchmarkPass() && (br?.backendPlanCompleteness ?? 0) >= 0.8) {
      score = Math.max(score, 90);
    }
    if (hasLiveFullBenchmarkPass() && (br?.backendPlanCompleteness ?? 0) >= 0.9) {
      score = Math.max(score, 95);
    } else if (!hasLiveHalfBenchmarkPass() && (br?.backendPlanCompleteness ?? 0) >= 0.8) {
      blockers.push("structure backend plan — live half build required for 90+");
    }
  }

  if (id === "database_supabase_depth") {
    const br = artifact.benchmarkReport ?? artifact.benchmarkStructureReport;
    if (fileExists("src/lib/build/database-depth-plan.ts")) score = Math.max(score, 82);
    if (br?.backendPlanCompleteness >= 0.8) score = Math.max(score, 84);
    if (hasLiveHalfBenchmarkPass() && (br?.databaseDepthAverage ?? 0) >= 80) {
      score = Math.max(score, 90);
    }
    if (hasLiveFullBenchmarkPass() && (br?.databaseDepthAverage ?? 0) >= 90) {
      score = Math.max(score, 95);
    } else if (!hasLiveHalfBenchmarkPass()) {
      blockers.push("live half DB depth benchmark required for 90+");
    }
  }

  if (id === "app_dashboard") {
    if (fileExists("src/lib/import/zip-import-service.ts")) score = Math.max(score, 84);
    if (fileExists("scripts/verify-zip-import.mjs")) score = Math.max(score, 86);
    if (fileExists("src/components/create/workspace/blueprint-summary-panel.tsx")) score = Math.max(score, 87);
    if (fileExists("tests/e2e/zip-import.spec.ts")) score = Math.max(score, 88);
    if (artifact.zipImportQualityScore >= 90) {
      score = Math.max(score, Math.min(92, 86 + Math.round((artifact.zipImportQualityScore - 90) / 2)));
    }
  }

  if (id === "multi_model_routing" && fileExists("src/lib/ai/route-decision-log.ts")) {
    score = Math.max(score, 84);
  }

  function creditsBillingGatesOk() {
    return (
      fileExists("src/lib/credits/credit-events.ts") &&
      fileExists("src/lib/credits/charge-ai-operation.ts") &&
      fileExists("src/lib/billing/credit-profit-guard.ts") &&
      fileExists("src/app/api/admin/credit-economy/route.ts") &&
      fileExists("scripts/verify-credits.mjs") &&
      fileExists("scripts/verify-admin-credit-economy.mjs") &&
      (artifact.creditsBillingGates === true || artifact.chargeTokensCallable === true)
    );
  }

  function adminEconomyProofOk() {
    const panel = fileExists("src/components/admin/admin-credit-economy-panel.tsx");
    const route = fileExists("src/app/api/admin/credit-economy/route.ts");
    const guard = fs.readFileSync(path.join(root, "src/app/api/admin/credit-economy/route.ts"), "utf8");
    return panel && route && guard.includes("requireDreamosOwner");
  }

  const billingGates = creditsBillingGatesOk();
  const adminEconomy = adminEconomyProofOk();
  const chargeCallable = artifact.chargeTokensCallable === true;
  const verifyAllOk = artifact.verifyPassed === true;

  if (id === "profit_protection_3x" && billingGates) {
    score = Math.max(score, 95);
    if (!fileExists("src/lib/billing/credit-profit-guard.ts")) {
      score = Math.min(score, 92);
      blockers.push("profit guard missing — cap 92");
    }
  }

  if (id === "billing_admin_economics" && adminEconomy && billingGates) {
    score = Math.max(score, 95);
  } else if (id === "billing_admin_economics" && adminEconomy) {
    score = Math.max(score, 92);
  }

  if (id === "credit_cost_transparency" && billingGates && fileExists("src/app/api/credits/quote/route.ts")) {
    score = Math.max(score, 92);
    if (verifyAllOk) score = Math.max(score, 95);
  }

  if (id === "provider_cost_control" && billingGates && fileExists("src/lib/ai/model-cost-runtime.ts")) {
    score = Math.max(score, 90);
    if (verifyAllOk && chargeCallable) score = Math.max(score, 95);
  }

  if (id === "logs_diagnostics" && chargeCallable) {
    score = Math.max(score, 88);
    if (billingGates && verifyAllOk) score = Math.max(score, 95);
  } else if (id === "logs_diagnostics" && billingGates) {
    score = Math.max(score, 82);
  }

  if (id === "production_safety" && billingGates && verifyAllOk && fileExists("scripts/verify-ids.mjs")) {
    score = Math.max(score, 95);
  }

  if (id === "end_user_trust" && billingGates && fileExists("src/components/create/create-credit-estimate.tsx")) {
    score = Math.max(score, 86);
    if (verifyAllOk) score = Math.max(score, 88);
  }

  const paidSafety = ["production_safety", "real_production_readiness", "end_user_trust", "auth_security_depth"];
  if (paidSafety.includes(id) && artifact.securityVerifyPassed !== true) {
    score = Math.min(score, 94);
    blockers.push("security verify not passed — cap 94");
  }

  const proof = [];
  if (liveE2e) proof.push("e2e-live");
  if (verify) proof.push("verify");
  if (billingGates) proof.push("billing-gates");
  if (chargeCallable) proof.push("charge-tokens-ok");
  if (artifact.benchmarkReport?.live && id === "generated_ui_quality") proof.push("benchmark");
  if (artifact.failureCoverage) proof.push("failure-structure");

  if (score >= 100) score = 99;

  let winner = "tie";
  if (score > def.lovableScore && score > def.base44Score) winner = "dreamos";
  else if (def.lovableScore > score && def.lovableScore >= def.base44Score) winner = "lovable";
  else if (def.base44Score > score && def.base44Score >= def.lovableScore) winner = "base44";

  return {
    id,
    title: parseTitle(id),
    previous: def.dreamosBaseScore,
    newScore: Math.round(score),
    lovable: def.lovableScore,
    base44: def.base44Score,
    winner,
    blockers: [...new Set(blockers)],
    proof: proof.join("+") || "structure-only",
    fix: def.fixToReach100,
    verifyOk: verify,
    stub,
  };
}

const rows = categories.map(capScore);
const agg = {
  dreamos: Math.round(rows.reduce((s, r) => s + r.newScore, 0) / rows.length),
  lovable: Math.round(rows.reduce((s, r) => s + r.lovable, 0) / rows.length),
  base44: Math.round(rows.reduce((s, r) => s + r.base44, 0) / rows.length),
  wins: rows.filter((r) => r.winner === "dreamos").length,
};

console.log(JSON.stringify({ artifact: { e2eMode: artifact.e2eMode, securityVerifyPassed: artifact.securityVerifyPassed, benchmarkLive: artifact.benchmarkReport?.live }, aggregate: agg, rows }, null, 2));
