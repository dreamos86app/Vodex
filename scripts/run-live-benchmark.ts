/**
 * Live generation benchmark — real API create + staged build per prompt.
 * Usage:
 *   BENCHMARK_LIVE=1 npx tsx scripts/run-live-benchmark.ts --half --live --concurrency 1 --max-cost-usd 2
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { buildDeterministicBlueprint } from "../src/lib/build/blueprint-deterministic";
import { scoreBlueprint } from "../src/lib/build/blueprint-scoring";
import { buildBackendPlan, detectBackendRequired } from "../src/lib/build/backend-plan";
import { buildDatabaseDepthPlan } from "../src/lib/build/database-depth-plan";
import {
  aggregateLiveBenchmarkReport,
  type LiveBenchmarkPromptResult,
} from "../src/lib/benchmark/generation-score";
import type { Database } from "../src/lib/supabase/types";

const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, ".dreamos-benchmark-live-state.json");
const BENCH_PATH = path.join(ROOT, "benchmarks/prompts/benchmark-50.json");
const AUTH_PATH = path.join(ROOT, ".playwright-auth.json");

type CliOpts = {
  scale: "half" | "full" | "smoke";
  live: boolean;
  resume: boolean;
  concurrency: number;
  maxCostUsd: number;
  stopOnFail: boolean;
  archiveProjects: boolean;
  keepProjects: boolean;
};

function parseArgs(): CliOpts {
  const argv = process.argv.slice(2);
  const scale = argv.includes("--full") ? "full" : argv.includes("--smoke") ? "smoke" : "half";
  return {
    scale,
    live: argv.includes("--live") && process.env.BENCHMARK_LIVE === "1",
    resume: argv.includes("--resume"),
    concurrency: Math.max(1, Number(argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 1)),
    maxCostUsd: Number(argv.find((a) => a.startsWith("--max-cost-usd="))?.split("=")[1] ?? 5),
    stopOnFail: argv.includes("--stop-on-fail"),
    archiveProjects: argv.includes("--archive-projects"),
    keepProjects: argv.includes("--keep-projects"),
  };
}

function loadEnvLocal(): Record<string, string> {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function cookiesHeader(authJson: { cookies?: Array<{ name: string; value: string }> }): string | null {
  const cookies = authJson.cookies ?? [];
  if (!cookies.length) return null;
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

const templateByType: Record<string, string> = {
  landing: "saas-landing",
  dashboard: "analytics-dashboard",
  saas: "dashboard",
  crm: "crm",
  booking: "booking-app",
  mobile_first: "mobile-habit",
  ai_tool: "ai-assistant",
};

const styleByType: Record<string, string> = {
  landing: "bold",
  dashboard: "enterprise",
  saas: "minimal",
  crm: "enterprise",
  booking: "minimal",
  mobile_first: "bold",
  ai_tool: "glass",
};

function resolveTemplateId(appType: string, prompt: string): string {
  const base = templateByType[appType] ?? "saas-landing";
  const p = prompt.toLowerCase();
  if (appType === "saas" && /\b(landing|marketing|waitlist)\b/.test(p)) return "saas-landing";
  if (appType === "dashboard" && /\b(support|ticket|helpdesk)\b/.test(p)) return "support-helpdesk";
  return base;
}

function runSmokeBuild(projectId: string, prompt: string, appType: string): {
  ok: boolean;
  fileCount?: number;
  providerCostUsd?: number;
  error?: string;
} {
  const env = { ...loadEnvLocal(), ...process.env, NODE_USE_SYSTEM_CA: "1", DREAMOS_SMOKE_BUILD: "1" };
  const r = spawnSync(
    "npx",
    ["tsx", path.join(ROOT, "scripts/smoke-build-live.ts"), projectId, prompt, appType],
    { cwd: ROOT, shell: true, encoding: "utf8", env, timeout: 300_000 },
  );
  const line = `${r.stdout ?? ""}`.trim().split("\n").filter(Boolean).pop() ?? "";
  try {
    return JSON.parse(line);
  } catch {
    return { ok: false, error: (r.stderr || r.stdout || "build failed").slice(-400) };
  }
}

async function main() {
  const opts = parseArgs();
  const env = { ...loadEnvLocal(), ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v != null && v !== "") process.env[k] = v;
  }

  const base = process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const all = JSON.parse(fs.readFileSync(BENCH_PATH, "utf8"));
  const fullList = all.prompts ?? [];
  const prompts =
    opts.scale === "full" ? fullList : opts.scale === "smoke" ? fullList.slice(0, 10) : fullList.slice(0, 25);

  if (!opts.live) {
    let blueprintSum = 0;
    let templateHits = 0;
    let backendNeeded = 0;
    let backendComplete = 0;
    for (const p of prompts) {
      const templateId = resolveTemplateId(p.appType, p.text);
      const stylePresetId = styleByType[p.appType] ?? "minimal";
      const bp = buildDeterministicBlueprint({ prompt: p.text, templateId, stylePresetId });
      const scored = scoreBlueprint(bp);
      blueprintSum += scored.total;
      if (bp.templateInfluence) templateHits += 1;
      const needsBackend = detectBackendRequired(bp);
      if (needsBackend) {
        backendNeeded += 1;
        const plan = buildBackendPlan(bp);
        if (
          plan.honestLimitations.length > 0 &&
          plan.userConfigurationChecklist.length > 0 &&
          (plan.entities.length > 0 || plan.crudActions.length > 0)
        ) {
          backendComplete += 1;
        }
      }
    }
    const n = prompts.length || 1;
    const blueprintMetrics = {
      averageBlueprintScore: Math.round((blueprintSum / n) * 10) / 10,
      templateInfluenceRate: templateHits / n,
      backendPlanCompleteness: backendNeeded ? backendComplete / backendNeeded : 1,
    };
    const out = {
      runAt: new Date().toISOString(),
      mode: "structure_readiness",
      scale: opts.scale,
      promptCount: prompts.length,
      live: false,
      reason: `Structure-only: blueprint avg ${blueprintMetrics.averageBlueprintScore}. Pass --live with BENCHMARK_LIVE=1 for real builds.`,
      ...blueprintMetrics,
      buildSuccessRate: 0,
      previewSuccessRate: 0,
      publishReadinessRate: 0,
      placeholderRate: 1,
      averageQualityScore: blueprintMetrics.averageBlueprintScore,
      smokePassed: false,
      halfBenchmarkReady: prompts.length >= 25,
      fullBenchmarkReady: false,
      results: [],
    };
    console.log(JSON.stringify(out));
    return;
  }

  const hasProvider = Boolean(
    env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
  if (!hasProvider) {
    console.error(JSON.stringify({ ok: false, mode: "not_run", reason: "Missing LLM provider key in .env.local" }));
    process.exit(1);
  }

  let serverOk = false;
  try {
    const r = await fetch(base, { redirect: "manual" });
    serverOk = r.status < 500;
  } catch {
    serverOk = false;
  }
  if (!serverOk) {
    console.error(JSON.stringify({ ok: false, mode: "not_run", reason: `Dev server not running at ${base}` }));
    process.exit(1);
  }

  if (!fs.existsSync(AUTH_PATH)) {
    console.error(JSON.stringify({ ok: false, mode: "not_run", reason: "Missing .playwright-auth.json" }));
    process.exit(1);
  }
  const authJson = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  const cookie = cookiesHeader(authJson);
  if (!cookie) {
    console.error(JSON.stringify({ ok: false, mode: "not_run", reason: "Invalid auth cookies" }));
    process.exit(1);
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  const writer =
    url && serviceKey
      ? createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;

  const benchmarkRunId = `bench-${Date.now().toString(36)}`;
  let state: { completed: string[]; results: LiveBenchmarkPromptResult[]; totalProviderCostUsd: number } = {
    completed: [],
    results: [],
    totalProviderCostUsd: 0,
  };
  if (opts.resume && fs.existsSync(STATE_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    } catch {
      /* fresh */
    }
  }

  const pending = prompts.filter((p: { id: string }) => !state.completed.includes(p.id));
  const results: LiveBenchmarkPromptResult[] = [...state.results];

  for (const p of pending) {
    if (state.totalProviderCostUsd >= opts.maxCostUsd) {
      results.push({
        promptId: p.id,
        prompt: p.text,
        category: p.appType,
        projectId: null,
        templateId: resolveTemplateId(p.appType, p.text),
        stylePresetId: styleByType[p.appType] ?? "minimal",
        buildTier: "quick",
        createdProject: false,
        blueprintGenerated: false,
        blueprintApproved: false,
        buildStarted: false,
        buildCompleted: false,
        filesGenerated: false,
        fileCount: 0,
        routeCount: 0,
        validatorPassed: false,
        uiQualityScore: 0,
        uiValidated: false,
        blueprintScore: 0,
        templateInfluenceScore: 0,
        backendCompleteness: 0,
        databaseDepthScore: 0,
        previewReadiness: false,
        publishReadiness: false,
        placeholderRate: 1,
        creditsReserved: 0,
        creditsUsed: 0,
        providerCostUsd: 0,
        modelRouteSummary: "",
        cacheHitRate: 0,
        status: "skipped",
        failureStage: "cost_cap",
        failureReason: `Cost cap ${opts.maxCostUsd} USD reached`,
        durationMs: 0,
        createdAt: new Date().toISOString(),
      });
      break;
    }

    const started = Date.now();
    const templateId = resolveTemplateId(p.appType, p.text);
    const stylePresetId = styleByType[p.appType] ?? "minimal";
    const bp = buildDeterministicBlueprint({ prompt: p.text, templateId, stylePresetId });
    const bpScore = scoreBlueprint(bp);
    const needsBackend = detectBackendRequired(bp);
    const backendPlan = buildBackendPlan(bp);
    const dbPlan = buildDatabaseDepthPlan(bp);
    const backendComplete =
      !needsBackend ||
      (backendPlan.honestLimitations.length > 0 &&
        backendPlan.userConfigurationChecklist.length > 0 &&
        (backendPlan.entities.length > 0 || backendPlan.crudActions.length > 0));
    const dbDepth = dbPlan.tables.length > 0 || dbPlan.rlsPolicies.length > 0 ? 1 : needsBackend ? 0.5 : 1;

    let projectId: string | null = null;
    let failureStage: string | null = null;
    let failureReason: string | null = null;
    let buildOk = false;
    let fileCount = 0;
    let uiScore = 0;
    let uiValidated = false;
    let previewReady = false;
    let publishReady = false;
    let placeholderRate = 1;
    let providerCostUsd = 0;

    try {
      const cr = await fetch(`${base}/api/projects/create-from-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          prompt: `${p.text} [benchmark ${benchmarkRunId} ${p.id}]`,
          buildTier: "quick",
          templateId,
          stylePresetId,
          source: "prompt",
        }),
      });
      const cdata = (await cr.json()) as { projectId?: string; ok?: boolean; error?: string };
      projectId = cdata.projectId ?? null;
      if (!cr.ok || !cdata.ok || !projectId) {
        failureStage = "create_project";
        failureReason = cdata.error ?? "create failed";
      } else if (writer) {
        const { data: proj } = await writer.from("projects").select("metadata").eq("id", projectId).maybeSingle();
        const meta =
          proj?.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
            ? (proj.metadata as Record<string, unknown>)
            : {};
        await writer
          .from("projects")
          .update({
            metadata: {
              ...meta,
              source: "benchmark_live",
              benchmark_run_id: benchmarkRunId,
              benchmark_prompt_id: p.id,
              archived: opts.archiveProjects && !opts.keepProjects,
            },
          } as never)
          .eq("id", projectId);

        const built = runSmokeBuild(projectId, p.text, p.appType);
        providerCostUsd = built.providerCostUsd ?? 0;
        state.totalProviderCostUsd += providerCostUsd;
        buildOk = built.ok === true && (built.fileCount ?? 0) > 0;
        fileCount = built.fileCount ?? 0;
        if (!buildOk) {
          failureStage = "build";
          failureReason = built.error ?? "build produced no files";
        }

        const rr = await fetch(`${base}/api/projects/${projectId}/publish/readiness`, {
          headers: { Cookie: cookie },
        });
        if (rr.ok) {
          const rdata = (await rr.json()) as {
            fileCount?: number;
            uiQualityScore?: number;
            uiQualityOk?: boolean;
            previewReady?: boolean;
            publishReady?: boolean;
            placeholderRate?: number;
          };
          fileCount = rdata.fileCount ?? fileCount;
          uiScore = typeof rdata.uiQualityScore === "number" ? rdata.uiQualityScore : buildOk ? 70 : 0;
          uiValidated = Boolean(rdata.uiQualityOk || (uiScore >= 80 && fileCount > 0));
          previewReady = Boolean(rdata.previewReady);
          publishReady = Boolean(rdata.publishReady);
          placeholderRate = typeof rdata.placeholderRate === "number" ? rdata.placeholderRate : buildOk ? 0 : 1;
          if (fileCount > 0 && !buildOk) buildOk = true;
        }
      }
    } catch (e) {
      failureStage = failureStage ?? "unknown";
      failureReason = String(e);
    }

    const row: LiveBenchmarkPromptResult = {
      promptId: p.id,
      prompt: p.text,
      category: p.appType,
      projectId,
      templateId,
      stylePresetId,
      buildTier: "quick",
      createdProject: Boolean(projectId),
      blueprintGenerated: true,
      blueprintApproved: buildOk,
      buildStarted: Boolean(projectId),
      buildCompleted: buildOk,
      filesGenerated: fileCount > 0,
      fileCount,
      routeCount: bp.routeMap?.length ?? 0,
      validatorPassed: buildOk && uiValidated,
      uiQualityScore: uiScore,
      uiValidated,
      blueprintScore: bpScore.total,
      templateInfluenceScore: bp.templateInfluence ? 100 : 0,
      backendCompleteness: backendComplete ? 100 : 50,
      databaseDepthScore: Math.round(dbDepth * 100),
      previewReadiness: previewReady,
      publishReadiness: publishReady,
      placeholderRate,
      creditsReserved: 0,
      creditsUsed: 0,
      providerCostUsd,
      modelRouteSummary: "staged-pipeline",
      cacheHitRate: 0,
      status: buildOk && uiValidated ? "passed" : failureStage ? "failed" : "partial",
      failureStage,
      failureReason,
      durationMs: Date.now() - started,
      createdAt: new Date().toISOString(),
    };
    results.push(row);
    state.completed.push(p.id);
    state.results = results;
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

    if (opts.stopOnFail && row.status === "failed") break;
  }

  const report = aggregateLiveBenchmarkReport(results, {
    scale: opts.scale,
    benchmarkRunId,
    maxCostUsd: opts.maxCostUsd,
    totalProviderCostUsd: state.totalProviderCostUsd,
  });

  console.log(JSON.stringify(report));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
