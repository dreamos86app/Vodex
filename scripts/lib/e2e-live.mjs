/**
 * Shared live E2E / benchmark proof helpers.
 * Never logs cookie values, tokens, or storage secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(scriptDir, "..", "..");
export const AUTH_PATH = path.join(ROOT, ".playwright-auth.json");
export const GITIGNORE_PATH = path.join(ROOT, ".gitignore");
export const EVIDENCE_PATH = path.join(ROOT, ".dreamos-evidence.json");
export const BENCHMARK_RESULTS_PATH = path.join(ROOT, ".dreamos-benchmark-results.json");
export const BENCHMARK_RESULTS_LIVE_PATH = path.join(ROOT, ".dreamos-benchmark-results.live.json");
export const BENCHMARK_RESULTS_STRUCTURE_PATH = path.join(
  ROOT,
  ".dreamos-benchmark-results.structure.json",
);
export const BENCHMARK_MD_PATH = path.join(ROOT, "benchmarks/reports/benchmark-report.md");
export const E2E_REPORT_PATH = path.join(ROOT, "tests/e2e/report.json");

const SECRET_PATTERNS = [
  /service_role/i,
  /SUPABASE_SERVICE_ROLE/i,
  /sk_live_[a-zA-Z0-9]{10,}/,
  /OPENAI_API_KEY\s*=/,
  /ANTHROPIC_API_KEY\s*=/,
];

export function getBaseUrl() {
  return process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
}

export async function serverUp(baseUrl = getBaseUrl()) {
  try {
    const r = await fetch(baseUrl, { redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

/** Returns false if Playwright Chromium needs downloading. */
export function playwrightBrowsersInstalled() {
  const r = spawnSync("npx", ["playwright", "install", "chromium", "--dry-run"], {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (/Executable doesn't exist|will download|Downloading/i.test(out)) return false;
  return true;
}

export function checkGitignore() {
  const errors = [];
  if (!fs.existsSync(GITIGNORE_PATH)) {
    errors.push(".gitignore missing");
    return { ok: false, errors };
  }
  const gi = fs.readFileSync(GITIGNORE_PATH, "utf8");
  if (!gi.includes(".playwright-auth.json")) {
    errors.push(".playwright-auth.json is not in .gitignore");
  }
  if (!gi.includes(".dreamos-evidence.json")) {
    errors.push(".dreamos-evidence.json should be gitignored");
  }
  for (const p of [
    ".dreamos-benchmark-results.json",
    ".dreamos-benchmark-results.live.json",
    ".dreamos-benchmark-results.structure.json",
  ]) {
    if (!gi.includes(p)) errors.push(`${p} should be gitignored`);
  }
  return { ok: errors.length === 0, errors };
}

export function isLiveBenchmarkResult(result) {
  return (
    result?.mode === "live_passed" ||
    result?.mode === "live_partial" ||
    result?.mode === "live_failed"
  );
}

export function isStructureBenchmarkResult(result) {
  return (
    result?.mode === "structure_fixtures" ||
    result?.mode === "structure_only" ||
    result?.mode === "structure_readiness" ||
    result?.mode === "structure_blueprint_half"
  );
}

export function loadBenchmarkFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** Write benchmark artifact to mode-specific file; latest pointer never erases live proof file. */
export function writeBenchmarkArtifact(result) {
  fs.writeFileSync(BENCHMARK_RESULTS_PATH, JSON.stringify(result, null, 2));
  if (isLiveBenchmarkResult(result)) {
    fs.writeFileSync(BENCHMARK_RESULTS_LIVE_PATH, JSON.stringify(result, null, 2));
  } else if (isStructureBenchmarkResult(result)) {
    fs.writeFileSync(BENCHMARK_RESULTS_STRUCTURE_PATH, JSON.stringify(result, null, 2));
  }
}

export function liveBenchmarkProofValid(result) {
  if (!result || !isLiveBenchmarkResult(result)) return false;
  if (result.smokePassed !== true) return false;
  return (result.averageQualityScore ?? 0) >= 80 || (result.previewSuccessRate ?? 0) >= 0.85;
}

/** Prefer preserved live benchmark when smoke passed; fall back to structure/latest. */
export function loadPreferredBenchmarkResult() {
  const live = loadBenchmarkFile(BENCHMARK_RESULTS_LIVE_PATH);
  const structure = loadBenchmarkFile(BENCHMARK_RESULTS_STRUCTURE_PATH);
  const latest = loadBenchmarkFile(BENCHMARK_RESULTS_PATH);

  if (liveBenchmarkProofValid(live)) {
    return { result: live, source: "live" };
  }
  if (structure) {
    return { result: structure, source: "structure" };
  }
  if (latest) {
    const source = isLiveBenchmarkResult(latest) ? "live" : "structure";
    return { result: latest, source };
  }
  return null;
}

export function buildBenchmarkReport(result, source) {
  const live = isLiveBenchmarkResult(result);
  const livePartial = result.mode === "live_partial";
  const structureFixtures = isStructureBenchmarkResult(result);
  const smokePassed =
    result.smokePassed === true &&
    (live || livePartial ? (result.averageQualityScore ?? 0) >= 80 || (result.previewSuccessRate ?? 0) >= 0.85 : true);

  return {
    live: live || livePartial,
    structureFixtures,
    mode: result.mode,
    benchmarkEvidenceSource: source,
    promptCount: result.promptCount ?? 0,
    placeholderRate: result.placeholderRate ?? 1,
    buildSuccessRate: result.buildSuccessRate ?? 0,
    previewSuccessRate: result.previewSuccessRate ?? 0,
    publishReadinessRate: result.publishReadinessRate ?? 0,
    averageCredits: result.averageCredits ?? 0,
    averageQualityScore: result.averageQualityScore ?? 0,
    averageMobileScore: result.averageMobileScore ?? 0,
    smokePassed,
    fullBenchmarkPending: (result.promptCount ?? 0) < 50 || !live,
    reason: result.reason ?? "",
    uiCompleteness: result.uiCompleteness ?? 0,
    appSpecificRelevance: result.appSpecificRelevance ?? 0,
    visualPolish: result.visualPolish ?? 0,
    mobileReadiness: result.mobileReadiness ?? 0,
    routeCompleteness: result.routeCompleteness ?? 0,
    interactionCompleteness: result.interactionCompleteness ?? 0,
    qualityBeforePolish: result.qualityBeforePolish ?? 0,
    qualityAfterPolish: result.qualityAfterPolish ?? 0,
    validatorFailMarkedGenerated: result.validatorFailMarkedGenerated ?? 0,
    averageBlueprintScore: result.averageBlueprintScore ?? 0,
    templateInfluenceRate: result.templateInfluenceRate ?? 0,
    backendPlanCompleteness: result.backendPlanCompleteness ?? 0,
    databaseDepthAverage: result.databaseDepthAverage ?? 0,
    uiValidationRate: result.uiValidationRate ?? 0,
    fileGenerationRate: result.fileGenerationRate ?? 0,
    previewReadinessRate: result.previewReadinessRate ?? result.previewSuccessRate ?? 0,
    averageProviderCostUsd: result.averageProviderCostUsd ?? 0,
    totalProviderCostUsd: result.totalProviderCostUsd ?? 0,
    halfBenchmarkReady: result.halfBenchmarkReady ?? false,
    fullBenchmarkReady: result.fullBenchmarkReady ?? false,
    failedPrompts: result.failedPrompts ?? [],
    topFailureStages: result.topFailureStages ?? [],
    failedAppTypes: result.failedAppTypes ?? result.failedPrompts ?? [],
    runAt: result.runAt ?? null,
  };
}

/** Merge benchmark into evidence; structure runs must not downgrade live proof. */
export function applyBenchmarkToEvidence(evidence, result, source) {
  const report = buildBenchmarkReport(result, source);
  const existing = evidence.benchmarkReport;
  const preserveLive =
    source === "structure" &&
    existing?.live === true &&
    existing?.smokePassed === true &&
    (existing.benchmarkEvidenceSource === "live" || liveBenchmarkProofValid(loadBenchmarkFile(BENCHMARK_RESULTS_LIVE_PATH)));

  if (preserveLive) {
    evidence.benchmarkStructureReport = report;
    evidence.benchmarkEvidenceSource = "live";
    return evidence;
  }

  evidence.benchmarkReport = report;
  evidence.benchmarkEvidenceSource = source;
  if (source === "live" && (result.averageQualityScore ?? 0) > 0) {
    evidence.generatedUiQualityBefore = evidence.generatedUiQualityBefore ?? 58;
    evidence.generatedUiQualityAfter = result.averageQualityScore;
  }
  return evidence;
}

export function authFileExists() {
  try {
    return fs.existsSync(AUTH_PATH) && fs.statSync(AUTH_PATH).size > 10;
  } catch {
    return false;
  }
}

/** Parse auth JSON; never return raw cookie values to callers for logging. */
export function readAuthFile() {
  if (!authFileExists()) {
    return { ok: false, errors: ["missing or empty"], meta: null, json: null };
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  } catch {
    return { ok: false, errors: ["not valid JSON"], meta: null, json: null };
  }
  const cookies = Array.isArray(json.cookies) ? json.cookies : [];
  const errors = [];
  if (cookies.length === 0) errors.push("no cookies in auth file");

  const raw = fs.readFileSync(AUTH_PATH, "utf8");
  for (const re of SECRET_PATTERNS) {
    if (re.test(raw)) {
      errors.push(`auth file may contain secrets (${re.source}) — regenerate via codegen only`);
      break;
    }
  }

  const meta = {
    bytes: fs.statSync(AUTH_PATH).size,
    cookieCount: cookies.length,
    cookieNames: cookies.map((c) => c.name).filter(Boolean),
  };

  return { ok: errors.length === 0, errors, meta, json };
}

export function cookiesHeader(authJson) {
  const cookies = authJson?.cookies ?? [];
  if (!cookies.length) return null;
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export function writeEvidence(patch) {
  let cur = {};
  try {
    cur = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
  } catch {
    /* */
  }
  fs.writeFileSync(
    EVIDENCE_PATH,
    JSON.stringify({ ...cur, ...patch, e2eLastRun: new Date().toISOString() }, null, 2),
  );
}

export function loadEvidence() {
  try {
    return JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function parsePlaywrightReport(reportPath = E2E_REPORT_PATH) {
  const tests = [];
  if (!fs.existsSync(reportPath)) return tests;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    function walkSuites(suites) {
      for (const suite of suites ?? []) {
        walkSuites(suite.suites);
        for (const spec of suite.specs ?? []) {
          const status = spec.tests?.[0]?.results?.[0]?.status ?? (spec.ok ? "passed" : "failed");
          tests.push({
            name: spec.title,
            file: spec.file,
            passed: status === "passed",
            skipped: status === "skipped",
            failed: status === "failed",
            status,
          });
        }
      }
    }
    walkSuites(report.suites);
  } catch {
    /* */
  }
  return tests;
}

export function writeBenchmarkMarkdown(result) {
  const md = `# Benchmark report

Generated: ${result.runAt ?? new Date().toISOString()}

| Field | Value |
|-------|-------|
| Mode | ${result.mode ?? "unknown"} |
| Live | ${result.mode === "live_passed" || result.mode === "live_partial" ? "yes" : "no"} |
| Prompts | ${result.promptCount ?? 0} |
| Build success | ${((result.buildSuccessRate ?? 0) * 100).toFixed(1)}% |
| Preview success | ${((result.previewSuccessRate ?? 0) * 100).toFixed(1)}% |
| Placeholder rate | ${((result.placeholderRate ?? 1) * 100).toFixed(1)}% |
| Avg UI quality | ${(result.averageQualityScore ?? 0).toFixed(1)} |
| Smoke passed | ${result.smokePassed === true ? "yes" : "no"} |

## Reason
${result.reason || "n/a"}

## UI quality categories
| Category | Score |
|----------|-------|
| UI completeness | ${(result.uiCompleteness ?? 0).toFixed(1)} |
| App-specific relevance | ${(result.appSpecificRelevance ?? 0).toFixed(1)} |
| Visual polish | ${(result.visualPolish ?? 0).toFixed(1)} |
| Mobile readiness | ${(result.mobileReadiness ?? 0).toFixed(1)} |
| Route completeness | ${(result.routeCompleteness ?? 0).toFixed(1)} |
| Interaction completeness | ${(result.interactionCompleteness ?? 0).toFixed(1)} |

## Results
${(result.results ?? []).map((r) => `- **${r.id ?? r.prompt?.slice(0, 40) ?? "?"}**: ${r.note ?? r.error ?? (r.buildSuccess ? "ok" : "fail")}`).join("\n") || "_No per-prompt results_"}
`;
  fs.mkdirSync(path.dirname(BENCHMARK_MD_PATH), { recursive: true });
  fs.writeFileSync(BENCHMARK_MD_PATH, md);
  return BENCHMARK_MD_PATH;
}
