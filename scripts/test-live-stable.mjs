#!/usr/bin/env node
/**
 * P1.3.4 / P1.3.6 — Single-server stable live validation orchestrator.
 * npm run test:live:stable
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  MAX_STABLE_RUNTIME_MS,
  STABLE_BASE_URL,
  acquireStableDevServer,
  assertServerStillHealthy,
  canRestartReusedDevServer,
  createServerCrashGuard,
  readLogTail,
  recoverBetweenSteps,
  stopRunnerDevServer,
} from "./lib/stable-live-server.mjs";
import { killPortProcessSafely, portHolderPid } from "./lib/dev-server.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "artifacts", "benchmarks", "p13");
const artifactPath = path.join(outDir, "live-stable-run.json");

const runStarted = Date.now();
const deadline = runStarted + MAX_STABLE_RUNTIME_MS;

const result = {
  server_started_by_runner: false,
  server_pid: null,
  server_ownership_mode: null,
  base_url: STABLE_BASE_URL,
  total_runtime_ms: 0,
  tests_run: [],
  tests_passed: 0,
  tests_failed: 0,
  first_failure: null,
  server_crashed: false,
  server_recoveries: [],
  failed_categories: [],
  final_go_no_go: "NO-GO",
  generatedAt: new Date().toISOString(),
};

function writeArtifact() {
  result.total_runtime_ms = Date.now() - runStarted;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(result, null, 2));
}

function checkDeadline(stepId) {
  if (Date.now() > deadline) {
    throw new Error(`hard_timeout_exceeded at step ${stepId} (max ${MAX_STABLE_RUNTIME_MS / 60000} min)`);
  }
}

function runStep(step) {
  checkDeadline(step.id);
  console.log(`\n=== [stable] ${step.id} ===\n`);

  const env = {
    ...process.env,
    E2E_BASE_URL: STABLE_BASE_URL,
    PLAYWRIGHT_BASE_URL: STABLE_BASE_URL,
    E2E_RUN_LIVE: "1",
    VODEX_REUSE_DEV_SERVER: "1",
    PLAYWRIGHT_SKIP_SERVER: "1",
    NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1",
    ...(step.env ?? {}),
  };

  const started = Date.now();
  const r = spawnSync(step.cmd, step.args ?? [], {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env,
    timeout: step.timeoutMs ?? Math.max(60_000, deadline - Date.now()),
  });

  const entry = {
    id: step.id,
    pass: r.status === 0,
    exitCode: r.status ?? 1,
    durationMs: Date.now() - started,
    category: step.category ?? null,
  };

  result.tests_run.push(entry);
  if (entry.pass) {
    result.tests_passed += 1;
  } else if (step.optional) {
    entry.optional = true;
    console.warn(`[stable] optional step ${step.id} failed (exit ${entry.exitCode}) — continuing`);
  } else {
    result.tests_failed += 1;
    if (!result.first_failure) {
      result.first_failure = {
        step: step.id,
        exitCode: entry.exitCode,
        stderr: (r.stderr ?? "").slice(-2000),
        stdout: (r.stdout ?? "").slice(-2000),
      };
    }
    if (step.category) result.failed_categories.push(step.category);
  }

  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  return r.status === 0;
}

function failRun(reason, extra = {}) {
  result.server_crashed = extra.server_crashed ?? result.server_crashed;
  if (extra.logTail) result.server_log_tail = extra.logTail;
  if (extra.after_step) result.server_unhealthy_after_step = extra.after_step;
  if (extra.pid) result.server_unhealthy_pid = extra.pid;
  if (extra.last_health_error) result.last_health_error = extra.last_health_error;
  if (extra.next_command) result.next_command = extra.next_command;
  if (extra.recovery) result.server_recoveries.push(extra.recovery);
  result.final_go_no_go = "NO-GO";
  result.failure_reason = reason;
  writeArtifact();
  console.error(`\n✗ test:live:stable aborted — ${reason}\n`);
  if (extra.next_command) {
    console.error(`Next: ${extra.next_command}\n`);
  }
  process.exit(1);
}

let serverState = null;
let crashed = false;
let crashGuardDetach = () => {};

function attachCrashGuard() {
  crashGuardDetach();
  crashGuardDetach = createServerCrashGuard(serverState, root, (info) => {
    crashed = true;
    result.server_crashed = true;
    result.server_log_tail = info.logTail;
    result.first_failure = { step: "server_crash", ...info };
    result.failed_categories.push("dev_server");
    writeArtifact();
    console.error("\n✗ Dev server exited during stable live run — stopping.\n");
    process.exit(1);
  });
}

async function runRecoveryBoundary(afterStep) {
  checkDeadline(`recovery:${afterStep}`);
  console.log(`\n=== [stable] recovery after ${afterStep} ===\n`);

  try {
    const { serverState: nextState, event } = await recoverBetweenSteps(afterStep, serverState, root);
    serverState = nextState;
    result.server_started_by_runner = serverState.startedByRunner;
    result.server_pid = serverState.pid;
    result.server_ownership_mode = serverState.ownershipMode;
    if (event) {
      result.server_recoveries.push(event);
      console.log(
        `[stable] server recovered after ${afterStep} (PID ${event.old_pid} → ${event.new_pid}, ${event.downtime_ms}ms)`,
      );
    } else {
      console.log(`[stable] server healthy after ${afterStep} — no restart needed`);
    }
    attachCrashGuard();
  } catch (err) {
    failRun(err?.message ?? "server_recovery_failed", {
      after_step: err?.server_unhealthy_after_step ?? afterStep,
      pid: err?.pid,
      last_health_error: err?.last_health_error ?? err?.reason,
      logTail: err?.logTail ?? readLogTail(root, 200),
      next_command: err?.next_command ?? "npm run doctor:dev-server -- --restart-if-unhealthy",
      recovery: err?.recovery,
      server_crashed: false,
    });
  }
}

async function main() {
  process.env.E2E_RUN_LIVE = "1";
  process.env.VODEX_ALLOW_RESTART_REUSED_DEV = "1";

  console.log("\n=== test:live:stable ===\n");
  console.log(`Base URL: ${STABLE_BASE_URL}`);
  console.log(`Hard max runtime: ${MAX_STABLE_RUNTIME_MS / 60000} minutes\n`);

  const existingPid = portHolderPid(3000);
  if (existingPid && canRestartReusedDevServer()) {
    console.log(`[stable] Clearing existing dev server PID ${existingPid} for runner-owned fresh start…`);
    killPortProcessSafely(3000);
    await new Promise((r) => setTimeout(r, 3500));
  }

  try {
    serverState = await acquireStableDevServer(root);
    result.server_started_by_runner = serverState.startedByRunner;
    result.server_pid = serverState.pid;
    result.server_ownership_mode = serverState.ownershipMode;
    result.base_url = serverState.baseUrl;
  } catch (err) {
    failRun(err instanceof Error ? err.message : String(err));
  }

  attachCrashGuard();

  await runRecoveryBoundary("startup:warm-routes");

  const steps = [
    {
      id: "setup:e2e-auth:headless",
      cmd: "npm",
      args: ["run", "setup:e2e-auth:headless"],
      env: { E2E_AUTO_PROVISION: "1" },
      timeoutMs: 65_000,
    },
    {
      id: "setup:e2e-credits",
      cmd: "npm",
      args: ["run", "setup:e2e-credits"],
      timeoutMs: 120_000,
    },
    {
      id: "verify:preview-metadata-consistency",
      cmd: "npm",
      args: ["run", "verify:preview-metadata-consistency"],
      category: "preview",
      timeoutMs: 120_000,
    },
    {
      id: "live:generated-app",
      cmd: "npx",
      args: [
        "playwright",
        "test",
        "tests/e2e/restaurant-inventory-workflow.spec.ts",
        "--grep",
        "@live",
        "--workers=1",
        "--retries=0",
      ],
      category: "generated_app",
      env: {
        E2E_SKIP_INLINE_QUEUE: "1",
        E2E_GENERATED_APP_PROOF_ONLY: "1",
      },
      timeoutMs: 20 * 60_000,
      recoverAfter: true,
      retryOnFail: true,
      maxRetries: 1,
    },
    {
      id: "live:public-rendering",
      cmd: "npm",
      args: ["run", "verify:public-rendering"],
      env: { PUBLISHED_TEST_SLUG: process.env.PUBLISHED_TEST_SLUG ?? "reciplyy-mq01rwer" },
      category: "public_rendering",
      timeoutMs: 120_000,
      recoverAfter: true,
    },
    {
      id: "live:zip-import",
      cmd: "npm",
      args: ["run", "verify:zip-import-live-route"],
      category: "zip_import",
      timeoutMs: 180_000,
      recoverAfter: true,
    },
    {
      id: "live:publish-state",
      cmd: "npm",
      args: ["run", "verify:publish-state"],
      category: "publish",
      timeoutMs: 60_000,
      recoverBefore: true,
    },
    {
      id: "live:mobile-smoke",
      cmd: "npx",
      args: [
        "playwright",
        "test",
        "tests/e2e/live-journeys.spec.ts",
        "--grep",
        "mobile",
        "--workers=1",
        "--retries=0",
      ],
      category: "mobile",
      timeoutMs: 5 * 60_000,
      optional: true,
    },
    {
      id: "benchmark:p13-scoreboard",
      cmd: "npm",
      args: ["run", "benchmark:p13-scoreboard"],
      env: { PUBLISHED_TEST_SLUG: process.env.PUBLISHED_TEST_SLUG ?? "reciplyy-mq01rwer" },
      timeoutMs: 12 * 60_000,
    },
  ];

  let allPass = true;

  for (const step of steps) {
    if (crashed) break;

    if (step.recoverBefore) {
      await runRecoveryBoundary(`before:${step.id}`);
    }

    try {
      await assertServerStillHealthy(serverState, root);
    } catch (err) {
      const wasCrash = err?.server_crashed === true;
      if (!wasCrash) {
        await runRecoveryBoundary(`unhealthy-before:${step.id}`);
      } else {
        result.server_crashed = true;
        result.server_log_tail = err.logTail ?? readLogTail(root, 200);
        failRun(err instanceof Error ? err.message : String(err), {
          server_crashed: true,
          logTail: result.server_log_tail,
        });
      }
    }

    const ok = runStep(step);
    let stepPass = ok;
    if (!stepPass && !step.optional && step.retryOnFail) {
      const maxRetries = step.maxRetries ?? 1;
      for (let attempt = 0; attempt < maxRetries && !stepPass; attempt++) {
        console.warn(`\n[stable] retry ${attempt + 1}/${maxRetries} for ${step.id} after recovery…\n`);
        await runRecoveryBoundary(`retry-before:${step.id}`);
        stepPass = runStep(step);
      }
    }
    if (!stepPass && !step.optional) {
      allPass = false;
      break;
    }

    if (step.recoverAfter && stepPass) {
      await runRecoveryBoundary(step.id);
    }
  }

  stopRunnerDevServer(serverState, root);

  result.final_go_no_go = allPass && !crashed ? "GO" : "NO-GO";
  writeArtifact();

  console.log("\n=== stable live run complete ===\n");
  console.log(`Passed: ${result.tests_passed}/${result.tests_run.length}`);
  console.log(`Recoveries: ${result.server_recoveries.length}`);
  console.log(`GO/NO-GO: ${result.final_go_no_go}`);
  console.log(`Artifact: ${artifactPath}\n`);

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  stopRunnerDevServer(serverState, root);
  failRun(err instanceof Error ? err.message : String(err));
});
