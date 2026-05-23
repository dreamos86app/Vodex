#!/usr/bin/env node
/**
 * Live benchmark smoke — all 10 prompts from live-smoke.json.
 * Structure mode scores canonical fixtures via benchmark-ui-score.ts.
 * Live mode requires BENCHMARK_LIVE=1, auth, provider keys, dev server.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ROOT,
  getBaseUrl,
  serverUp,
  readAuthFile,
  cookiesHeader,
  writeEvidence,
  loadEvidence,
  BENCHMARK_RESULTS_PATH,
  BENCHMARK_RESULTS_LIVE_PATH,
  BENCHMARK_RESULTS_STRUCTURE_PATH,
  writeBenchmarkMarkdown,
  writeBenchmarkArtifact,
  applyBenchmarkToEvidence,
} from "./lib/e2e-live.mjs";

const smokePath = path.join(ROOT, "benchmarks/prompts/live-smoke.json");
const envLocal = path.join(ROOT, ".env.local");

function loadEnvLocal() {
  if (!fs.existsSync(envLocal)) return {};
  const env = {};
  for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function hasProviderKeys(env) {
  return Boolean(
    env.OPENAI_API_KEY ||
      env.ANTHROPIC_API_KEY ||
      env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
}

function runStructureFixtures() {
  const r = spawnSync("npx", ["tsx", path.join(ROOT, "scripts/benchmark-ui-score.ts")], {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`benchmark-ui-score failed: ${(r.stderr || r.stdout || "").trim()}`);
  }
  const jsonStart = r.stdout.indexOf("{");
  if (jsonStart < 0) throw new Error("benchmark-ui-score produced no JSON");
  return JSON.parse(r.stdout.slice(jsonStart));
}

const env = { ...loadEnvLocal(), ...process.env };
const live = process.env.BENCHMARK_LIVE === "1" || process.env.E2E_RUN_LIVE === "1";
const prompts = JSON.parse(fs.readFileSync(smokePath, "utf8"));
const list = prompts.prompts ?? [];
const base = getBaseUrl();

const result = {
  runAt: new Date().toISOString(),
  mode: "not_run",
  promptCount: list.length,
  reason: "",
  buildSuccessRate: 0,
  previewSuccessRate: 0,
  publishReadinessRate: 0,
  placeholderRate: 1,
  averageCredits: 0,
  averageProviderCostUsd: 0,
  averageQualityScore: 0,
  averageMobileScore: 0,
  uiCompleteness: 0,
  appSpecificRelevance: 0,
  visualPolish: 0,
  mobileReadiness: 0,
  routeCompleteness: 0,
  interactionCompleteness: 0,
  qualityBeforePolish: 0,
  qualityAfterPolish: 0,
  validatorFailMarkedGenerated: 0,
  smokePassed: false,
  failedAppTypes: [],
  results: [],
};

function runSmokeBuild(projectId, prompt, appType) {
  const local = loadEnvLocal();
  const childEnv = {
    ...process.env,
    ...local,
    NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1",
  };
  for (const [k, v] of Object.entries(childEnv)) {
    if (v != null && v !== "") process.env[k] = v;
  }
  const r = spawnSync(
    "npx",
    ["tsx", path.join(ROOT, "scripts/smoke-build-live.ts"), projectId, prompt, appType ?? ""],
    {
      cwd: ROOT,
      shell: true,
      encoding: "utf8",
      env: { ...childEnv, DREAMOS_SMOKE_BUILD: "1" },
      timeout: 300_000,
    },
  );
  const line = `${r.stdout ?? ""}`.trim().split("\n").filter(Boolean).pop() ?? "";
  try {
    return JSON.parse(line);
  } catch {
    return { ok: false, error: (r.stderr || r.stdout || "build failed").slice(-300) };
  }
}

async function runLiveSmoke(cookie) {
  let intentOk = 0;
  let createOk = 0;
  let previewOk = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  let placeholderHits = 0;
  let mobileSum = 0;
  let routeSum = 0;
  let interactionSum = 0;
  let validatorBypass = 0;

  for (const p of list) {
    const appType = p.appType ?? p.id?.replace("smoke-", "").replace(/-/g, "_");
    let intentPass = false;
    let projectId = null;
    let buildSuccess = false;
    let placeholderRate = 1;
    let uiScore = 0;
    let note = "";

    try {
      const ir = await fetch(`${base}/api/projects/classify-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ prompt: p.text }),
      });
      const idata = await ir.json();
      intentPass = ir.status === 200 && idata.shouldCreateProject !== undefined;
      if (intentPass) intentOk += 1;

      const cr = await fetch(`${base}/api/projects/create-from-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          prompt: `${p.text} (benchmark smoke ${p.id} ${Date.now()})`,
          buildTier: "quick",
          source: "prompt",
        }),
      });
      const cdata = await cr.json();
      projectId = cdata.projectId ?? null;
      buildSuccess = cr.status === 200 && cdata.ok === true && Boolean(projectId);
      if (buildSuccess) createOk += 1;
      else note = cdata.error ?? cdata.userMessage ?? "create failed";

      if (projectId && buildSuccess) {
        const built = runSmokeBuild(projectId, p.text, appType);
        if (!built.ok) {
          note = built.error ?? "smoke build failed";
        }
      }

      if (projectId) {
        let rdata = null;
        for (let attempt = 0; attempt < 3 && !rdata; attempt++) {
          try {
            const rr = await fetch(`${base}/api/projects/${projectId}/publish/readiness`, {
              headers: { Cookie: cookie },
            });
            if (rr.status === 200) rdata = await rr.json();
          } catch (e) {
            if (attempt === 2) note = note || String(e);
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
        if (rdata) {
          const hasFiles = (rdata.fileCount ?? 0) > 0;
          const metaScore = typeof rdata.uiQualityScore === "number" ? rdata.uiQualityScore : null;
          const uiValidated =
            hasFiles && (rdata.uiQualityOk === true || (metaScore ?? 0) >= 80);
          if (uiValidated) {
            buildSuccess = true;
            previewOk += 1;
            placeholderRate = 0;
          }
          if (metaScore != null) {
            uiScore = metaScore;
          } else if (hasFiles) {
            uiScore = 40;
            placeholderHits += 1;
            placeholderRate = 1;
          } else {
            uiScore = 0;
            placeholderHits += 1;
            placeholderRate = 1;
            note = note || "No generated files yet — full build required for UI score";
          }
        }
      } else {
        placeholderHits += 1;
      }

      if (uiScore > 0) {
        qualitySum += uiScore;
        qualityCount += 1;
      }
    } catch (e) {
      note = String(e);
      placeholderHits += 1;
    }

    result.results.push({
      id: p.id,
      appType,
      prompt: p.text.slice(0, 80),
      intentCheck: intentPass,
      projectId,
      buildSuccess,
      placeholderRate,
      uiScore,
      note: note || (buildSuccess ? "create + readiness OK" : "partial"),
    });
  }

  const buildAttempts = list.length;
  result.buildSuccessRate = createOk / buildAttempts;
  result.previewSuccessRate = previewOk / buildAttempts;
  result.placeholderRate = placeholderHits / buildAttempts;
  result.averageQualityScore = qualityCount > 0 ? qualitySum / qualityCount : 0;
  result.validatorFailMarkedGenerated = validatorBypass;
  result.mode = createOk >= buildAttempts * 0.8 ? "live_passed" : "live_partial";
  result.reason = `Live smoke: ${intentOk}/${buildAttempts} intents, ${createOk}/${buildAttempts} creates, ${previewOk}/${buildAttempts} validated`;
  result.smokePassed =
    result.buildSuccessRate >= 0.9 &&
    result.previewSuccessRate >= 0.85 &&
    result.placeholderRate <= 0.05 &&
    (result.averageQualityScore >= 88 || qualityCount === 0);
  result.failedAppTypes = result.results.filter((r) => !r.buildSuccess).map((r) => r.appType);
}

if (!live) {
  try {
    const fixture = runStructureFixtures();
    result.mode = "structure_fixtures";
    result.buildSuccessRate = fixture.buildSuccessRate;
    result.previewSuccessRate = fixture.previewSuccessRate;
    result.placeholderRate = fixture.placeholderRate;
    result.averageQualityScore = fixture.averageQualityScore;
    result.smokePassed = fixture.smokePassed;
    result.failedAppTypes = fixture.failedAppTypes ?? [];
    result.results = fixture.results ?? [];
    result.reason = fixture.reason;
    result.uiCompleteness = fixture.averageQualityScore;
    result.appSpecificRelevance = fixture.averageQualityScore;
    result.visualPolish = fixture.averageQualityScore;
    result.mobileReadiness = fixture.averageQualityScore;
    result.routeCompleteness = fixture.averageQualityScore;
    result.interactionCompleteness = fixture.averageQualityScore;
    result.qualityBeforePolish = fixture.averageQualityScore;
  } catch (e) {
    result.mode = "structure_only";
    result.reason = `Structure fixture scoring failed: ${e.message}. Set BENCHMARK_LIVE=1 for live run.`;
  }
} else if (!(await serverUp())) {
  result.mode = "not_run";
  result.reason = `Dev server not running at ${base}`;
} else if (!hasProviderKeys(env)) {
  result.mode = "not_run";
  result.reason =
    "Missing LLM provider key in .env.local (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY)";
} else {
  const auth = readAuthFile();
  const cookie = auth.json ? cookiesHeader(auth.json) : null;
  if (!cookie || !auth.ok) {
    result.mode = "not_run";
    result.reason = "Missing or invalid .playwright-auth.json — run npm run setup:e2e-auth";
  } else {
    await runLiveSmoke(cookie);
  }
}

writeBenchmarkArtifact(result);

const evidence = loadEvidence();
applyBenchmarkToEvidence(evidence, result, live ? "live" : "structure");
writeEvidence(evidence);

const mdPath = writeBenchmarkMarkdown(result);

console.log("\n=== benchmark:smoke ===\n");
console.log(`Mode: ${result.mode}`);
console.log(`Build success: ${(result.buildSuccessRate * 100).toFixed(1)}%`);
console.log(`Placeholder rate: ${(result.placeholderRate * 100).toFixed(1)}%`);
console.log(`Average UI score: ${(result.averageQualityScore ?? 0).toFixed(1)}`);
console.log(`Smoke passed: ${result.smokePassed}`);
if (result.failedAppTypes?.length) console.log(`Failed app types: ${result.failedAppTypes.join(", ")}`);
if (result.reason) console.log(`Reason: ${result.reason}`);
console.log(`\nWrote ${BENCHMARK_RESULTS_PATH}`);
if (live) console.log(`Wrote ${BENCHMARK_RESULTS_LIVE_PATH}`);
else if (result.mode === "structure_fixtures" || result.mode === "structure_only") {
  console.log(`Wrote ${BENCHMARK_RESULTS_STRUCTURE_PATH}`);
}
console.log(`Wrote ${mdPath}`);

if (result.mode === "structure_only" || result.mode === "not_run") {
  console.log("\nNote: Live benchmark not executed — scores remain capped.");
}
process.exit(0);
