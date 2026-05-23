/**
 * Shared localhost dev-server probe for verify scripts.
 * Fail-fast: 90s max readiness, 5s per probe, visible progress.
 */
import net from "node:net";
import { execSync } from "node:child_process";

export const PROBE_TIMEOUT_MS = 5_000;
export const READINESS_TIMEOUT_MS = 90_000;
export const READINESS_POLL_MS = 3_000;

export function devServerBaseUrl() {
  return process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
}

const PROBE_PATHS = ["/api/dev/ping", "/explore", "/"];

function probeUrls(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  const urls = PROBE_PATHS.map((p) => `${base}${p}`);
  if (!base.includes("127.0.0.1")) {
    urls.push(...PROBE_PATHS.map((p) => `http://127.0.0.1:3000${p}`));
  }
  if (!base.includes("localhost")) {
    urls.push(...PROBE_PATHS.map((p) => `http://localhost:3000${p}`));
  }
  return [...new Set(urls)];
}

async function probeOnce(url, timeoutMs = PROBE_TIMEOUT_MS) {
  try {
    const r = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "*/*" },
    });
    return { ok: r.status > 0 && r.status < 500, status: r.status, url };
  } catch (err) {
    return { ok: false, status: 0, url, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function isDevServerRunning(baseUrl = devServerBaseUrl(), { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  const probe = await probeDevServer(baseUrl, { timeoutMs });
  return probe.healthy;
}

/** Detailed probe — parallel URLs, max one probe timeout wait. */
export async function probeDevServer(baseUrl = devServerBaseUrl(), { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  const urls = probeUrls(baseUrl);
  const results = await Promise.all(urls.map(async (url) => ({ ...(await probeOnce(url, timeoutMs)), url })));
  const success = results.find((r) => r.ok);
  if (success) return { healthy: true, url: success.url, status: success.status };

  const last = results[0] ?? { url: baseUrl, status: 0, error: "connection failed" };
  return {
    healthy: false,
    url: last.url,
    status: last.status ?? 0,
    error: last.error ?? "connection failed",
  };
}

function portOpen(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

function portHolderPid(port = 3000) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const line = out.split(/\r?\n/).find((l) => l.includes("LISTENING"));
      if (!line) return null;
      const parts = line.trim().split(/\s+/);
      return parts[parts.length - 1] ?? null;
    }
    const out = execSync(`lsof -ti :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return out.trim().split(/\s+/)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Diagnose localhost:3000 — port bound vs HTTP healthy vs down.
 */
export async function diagnoseDevServer(baseUrl = devServerBaseUrl()) {
  const port = 3000;
  const host = baseUrl.includes("127.0.0.1") ? "127.0.0.1" : "127.0.0.1";
  const open = await portOpen(host, port);
  const pid = portHolderPid(port);
  const http = await probeDevServer(baseUrl);

  if (!open) {
    return {
      state: "down",
      message: `Port ${port} is not listening — dev server is not running.`,
      baseUrl,
      pid: null,
      http,
    };
  }

  if (!http.healthy) {
    return {
      state: "broken",
      message: `Port ${port} is in use (PID ${pid ?? "unknown"}) but HTTP probes failed: ${http.error ?? `status ${http.status}`}. The process may be stuck compiling or crashed.`,
      baseUrl,
      pid,
      http,
    };
  }

  return {
    state: "healthy",
    message: `Dev server healthy at ${http.url} (HTTP ${http.status})`,
    baseUrl,
    pid,
    http,
  };
}

export async function waitForDevServer({
  baseUrl = devServerBaseUrl(),
  timeoutMs = READINESS_TIMEOUT_MS,
  intervalMs = READINESS_POLL_MS,
  onTick,
} = {}) {
  const start = Date.now();
  let lastLog = 0;

  while (Date.now() - start < timeoutMs) {
    const elapsed = Date.now() - start;
    const probe = await probeDevServer(baseUrl);
    if (probe.healthy) return { ok: true, elapsed, url: probe.url };

    if (elapsed - lastLog >= intervalMs) {
      lastLog = elapsed;
      const sec = Math.round(elapsed / 1000);
      const msg = `Waiting for Next.js dev server… ${sec}s / ${Math.round(timeoutMs / 1000)}s`;
      if (onTick) onTick(msg, probe);
      else console.log(`[dev-server] ${msg}`);
    }

    await new Promise((r) => setTimeout(r, Math.min(intervalMs, 1000)));
  }

  const diag = await diagnoseDevServer(baseUrl);
  return { ok: false, elapsed: Date.now() - start, diagnose: diag };
}

export function printDevServerRequired(baseUrl = devServerBaseUrl(), diagnose = null) {
  console.error("\n✗ Dev server required for this step\n");
  console.error(`  Expected: ${baseUrl}`);
  if (diagnose) {
    console.error(`  Diagnosis: ${diagnose.message}`);
    if (diagnose.state === "broken") {
      console.error("\n  Port 3000 is occupied but not responding. Try:");
      console.error("    npm run doctor:dev-server");
      console.error("    npm run clean:next && npm run dev");
    }
  } else {
    console.error("\n  Start in another terminal:");
    console.error("    npm run dev");
    console.error("\n  Or run:");
    console.error("    npm run verify:all:no-benchmark:with-server");
    console.error("    npm run doctor:dev-server");
  }
  console.error("");
}

/** Fail-fast gate for live-route scripts. */
export async function requireDevServer(baseUrl = devServerBaseUrl()) {
  const diag = await diagnoseDevServer(baseUrl);
  if (diag.state === "healthy") {
    console.log(`[dev-server] ✓ ${diag.message}`);
    return diag;
  }
  printDevServerRequired(baseUrl, diag);
  process.exit(1);
}
