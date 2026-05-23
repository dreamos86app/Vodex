/**
 * Verify script runner — live output, heartbeats, fail-fast on silence.
 */
import { spawn, spawnSync } from "node:child_process";

export function formatElapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

const STEP_LIMITS = {
  typecheck: { maxSilenceMs: 120_000, maxTotalMs: 300_000 },
  build: { maxSilenceMs: 120_000, maxTotalMs: 600_000 },
  "verify:editor": { maxSilenceMs: 180_000, maxTotalMs: 300_000 },
  "verify:mobile-layout": { maxSilenceMs: 180_000, maxTotalMs: 300_000 },
  "verify:zip-import-live-route": { maxSilenceMs: 90_000, maxTotalMs: 180_000 },
  default: { maxSilenceMs: 120_000, maxTotalMs: 300_000 },
};

export function limitsForStep(name) {
  return STEP_LIMITS[name] ?? STEP_LIMITS.default;
}

/**
 * Run a shell command with piped streaming output and silence watchdog.
 */
export function runStep(name, cmd, { cwd, env, maxSilenceMs, maxTotalMs } = {}) {
  const limits = limitsForStep(name);
  const silenceLimit = maxSilenceMs ?? limits.maxSilenceMs;
  const totalLimit = maxTotalMs ?? limits.maxTotalMs;

  return new Promise((resolve) => {
    const started = Date.now();
    let lastOutput = Date.now();
    const logTail = [];

    console.log(`\n--- ${name} ---`);
    console.log(`[verify] ▶ started: ${cmd}`);

    const child = spawn(cmd, {
      cwd,
      shell: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const onData = (d, stream) => {
      lastOutput = Date.now();
      logTail.push(d.toString());
      if (logTail.length > 80) logTail.shift();
      if (stream === "stdout") process.stdout.write(d);
      else process.stderr.write(d);
    };

    child.stdout?.on("data", (d) => onData(d, "stdout"));
    child.stderr?.on("data", (d) => onData(d, "stderr"));

    let lastHeartbeat = 0;
    const watchdog = setInterval(() => {
      const elapsed = Date.now() - started;
      const silent = Date.now() - lastOutput;

      if (silent >= 60_000 && Date.now() - lastHeartbeat >= 60_000) {
        lastHeartbeat = Date.now();
        console.log(
          `[verify] ⏳ ${name} still running — ${formatElapsed(elapsed)} elapsed (${Math.round(silent / 1000)}s since last output)`,
        );
      }

      if (silent >= silenceLimit) {
        console.error(
          `\n✗ ${name} — no output for ${Math.round(silent / 1000)}s (limit ${Math.round(silenceLimit / 1000)}s). Killing.\n`,
        );
        if (logTail.length) {
          console.error("--- last output ---");
          console.error(logTail.slice(-15).join("").slice(-4000));
          console.error("--- end last output ---\n");
        }
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 2000);
        clearInterval(watchdog);
        resolve({ status: 1, elapsed, killed: "silence" });
        return;
      }

      if (elapsed >= totalLimit) {
        console.error(`\n✗ ${name} — exceeded total limit ${formatElapsed(totalLimit)}. Killing.\n`);
        child.kill("SIGTERM");
        clearInterval(watchdog);
        resolve({ status: 1, elapsed, killed: "timeout" });
      }
    }, 10_000);

    child.on("error", (err) => {
      clearInterval(watchdog);
      console.error(`\n✗ ${name} spawn error:`, err.message);
      resolve({ status: 1, elapsed: Date.now() - started, error: err.message });
    });

    child.on("close", (code) => {
      clearInterval(watchdog);
      const elapsed = Date.now() - started;
      if (code === 0) {
        console.log(`[verify] ✓ ${name} passed in ${formatElapsed(elapsed)}\n`);
      } else {
        console.error(`[verify] ✗ ${name} failed (exit ${code ?? 1}) in ${formatElapsed(elapsed)}\n`);
      }
      resolve({ status: code ?? 1, elapsed });
    });
  });
}

/** Sync spawn — use only for scripts guaranteed to finish in seconds. */
export function runStepSync(name, cmd, { cwd, env } = {}) {
  const started = Date.now();
  console.log(`\n--- ${name} ---`);
  console.log(`[verify] ▶ started: ${cmd}`);
  const r = spawnSync(cmd, { cwd, shell: true, stdio: "inherit", env });
  const elapsed = Date.now() - started;
  if (r.status === 0) console.log(`[verify] ✓ ${name} passed in ${formatElapsed(elapsed)}\n`);
  else console.error(`[verify] ✗ ${name} failed in ${formatElapsed(elapsed)}\n`);
  return { status: r.status ?? 1, elapsed };
}
