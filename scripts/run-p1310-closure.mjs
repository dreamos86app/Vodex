#!/usr/bin/env node
/**
 * P1.3.10 — Final live QA closure orchestrator.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { STABLE_BASE_URL, acquireStableDevServer, stopRunnerDevServer } from "./lib/stable-live-server.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "benchmarks", "p13");
const closurePath = path.join(outDir, "p1310-closure.json");

const started = Date.now();
const result = {
  executed: false,
  pass: false,
  timestamp: new Date().toISOString(),
  steps: {},
  failed_step: null,
  root_cause: null,
  total_runtime_ms: 0,
};

function writeClosure() {
  result.total_runtime_ms = Date.now() - started;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(closurePath, JSON.stringify(result, null, 2));
}

function run(cmd, args, opts = {}) {
  console.log(`\n=== ${opts.label ?? cmd} ===\n`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1",
      E2E_BASE_URL: STABLE_BASE_URL,
      PLAYWRIGHT_BASE_URL: STABLE_BASE_URL,
      E2E_RUN_LIVE: "1",
      PLAYWRIGHT_SKIP_SERVER: "1",
      VODEX_REUSE_DEV_SERVER: "1",
      ...(opts.env ?? {}),
    },
    timeout: opts.timeoutMs ?? 600_000,
  });
  const entry = {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout ?? "").slice(-3000),
    stderr: (r.stderr ?? "").slice(-2000),
  };
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return entry;
}

function fail(step, detail) {
  result.executed = true;
  result.pass = false;
  result.failed_step = step;
  result.root_cause = detail;
  writeClosure();
  console.error(`\n✗ P1.3.10 failed at ${step}: ${detail}\n`);
  process.exit(1);
}

result.executed = true;

result.steps.clean = run("npm", ["run", "clean"], { label: "clean", timeoutMs: 120_000 });
if (!result.steps.clean.ok) fail("clean", result.steps.clean.stderr);

result.steps.typecheck = run("npm", ["run", "typecheck"], { label: "typecheck", timeoutMs: 120_000 });
if (!result.steps.typecheck.ok) fail("typecheck", result.steps.typecheck.stderr);

result.steps.build = run("npm", ["run", "build"], { label: "build", timeoutMs: 300_000 });
if (!result.steps.build.ok) fail("build", result.steps.build.stderr);

result.steps.verify_p139 = run("npm", ["run", "verify:p139-production"], { label: "verify:p139-production", timeoutMs: 60_000 });
if (!result.steps.verify_p139.ok) fail("verify:p139-production", result.steps.verify_p139.stderr);

let serverState = null;
try {
  serverState = await acquireStableDevServer(root);
  console.log(`\n✓ Dev server ready at ${serverState.baseUrl} (PID ${serverState.pid})\n`);
} catch (err) {
  fail("dev_server", String(err?.message ?? err));
}

result.steps.setup_e2e_auth = run("npm", ["run", "setup:e2e-auth:headless"], {
  label: "setup:e2e-auth:headless",
  env: { E2E_AUTO_PROVISION: "1" },
  timeoutMs: 70_000,
});
if (!result.steps.setup_e2e_auth.ok) fail("setup:e2e-auth:headless", result.steps.setup_e2e_auth.stderr);

result.steps.test_live_stable = run("npm", ["run", "test:live:stable"], {
  label: "test:live:stable",
  env: { VODEX_ALLOW_RESTART_REUSED_DEV: "1" },
  timeoutMs: 45 * 60_000,
});
if (!result.steps.test_live_stable.ok) fail("test:live:stable", result.steps.test_live_stable.stderr);

const manualSpecs = [
  ["northly", "tests/e2e/p1310-manual-northly-qa.spec.ts"],
  ["reciply", "tests/e2e/imported-reciply-manual-qa.spec.ts"],
  ["ui", "tests/e2e/p1310-manual-ui-qa.spec.ts"],
];

for (const [key, spec] of manualSpecs) {
  const stepKey = `manual_qa_${key}`;
  result.steps[stepKey] = run(
    "npx",
    ["playwright", "test", spec, "--grep", "@live", "--workers=1", "--retries=0"],
    { label: `manual QA ${key}`, timeoutMs: 5 * 60_000 },
  );
  if (!result.steps[stepKey].ok) fail(stepKey, result.steps[stepKey].stderr);
}

result.steps.benchmark = run("npm", ["run", "benchmark:p13-scoreboard"], {
  label: "benchmark:p13-scoreboard",
  timeoutMs: 120_000,
});
if (!result.steps.benchmark.ok) fail("benchmark:p13-scoreboard", result.steps.benchmark.stderr);

if (serverState?.startedByRunner) {
  stopRunnerDevServer(serverState);
}

result.pass = true;
writeClosure();
console.log("\n✓ P1.3.10 closure complete — GO\n");
