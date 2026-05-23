/**
 * Run a TypeScript script via local tsx — avoids npx spawn hangs on Windows.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(scriptDir, "..", "..");

function tsxBin() {
  const cli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  if (fs.existsSync(cli)) return { cmd: process.execPath, args: [cli] };
  const name = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const bin = path.join(ROOT, "node_modules", ".bin", name);
  if (fs.existsSync(bin)) return { cmd: bin, args: [] };
  return null;
}

export function runTsxScript(scriptRel, args = [], opts = {}) {
  const resolved = tsxBin();
  const script = path.join(ROOT, scriptRel);
  const spawnOpts = {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: opts.env ?? process.env,
    timeout: opts.timeout,
    shell: false,
  };
  if (resolved) {
    return spawnSync(resolved.cmd, [...resolved.args, script, ...args], spawnOpts);
  }
  return spawnSync("npx", ["--yes", "tsx", script, ...args], { ...spawnOpts, shell: process.platform === "win32" });
}
