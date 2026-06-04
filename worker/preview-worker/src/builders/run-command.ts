import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { redactSecrets } from "../logger.js";

const execFileAsync = promisify(execFile);

export type CommandRunMeta = {
  command: string;
  args: string[];
};

/** Install must include devDependencies (vite, plugins). */
function previewInstallEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "development",
    NPM_CONFIG_PRODUCTION: "false",
    CI: "true",
  };
}

function previewBuildEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "production",
    CI: "true",
  };
}

export async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
): Promise<{ ok: boolean; logs: string; meta: CommandRunMeta }> {
  const meta: CommandRunMeta = { command: cmd, args: [...args] };
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env,
    });
    return {
      ok: true,
      logs: redactSecrets(`${stdout}\n${stderr}`),
      meta,
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      logs: redactSecrets(`${err.stdout ?? ""}\n${err.stderr ?? err.message ?? "failed"}`),
      meta,
    };
  }
}

export async function npmInstall(
  cwd: string,
  pm: "npm" | "pnpm" | "yarn",
  opts?: { preferInstall?: boolean },
): Promise<{ ok: boolean; logs: string; meta: CommandRunMeta }> {
  const ignoreScripts = config.allowNpmScripts ? [] : ["--ignore-scripts"];
  const env = previewInstallEnv();

  if (pm === "pnpm") {
    return runCommand(
      "pnpm",
      ["install", "--frozen-lockfile", ...ignoreScripts],
      cwd,
      config.installTimeoutMs,
      env,
    );
  }
  if (pm === "yarn") {
    return runCommand("yarn", ["install", ...ignoreScripts], cwd, config.installTimeoutMs, env);
  }

  const hasLock = await import("node:fs/promises")
    .then((fs) => fs.access(`${cwd}/package-lock.json`).then(() => true))
    .catch(() => false);

  const useCi = hasLock && !opts?.preferInstall;
  const args = useCi ? ["ci", ...ignoreScripts] : ["install", ...ignoreScripts];
  return runCommand("npm", args, cwd, config.installTimeoutMs, env);
}

export async function npmRunBuild(
  cwd: string,
  pm: "npm" | "pnpm" | "yarn",
  script = "build",
): Promise<{ ok: boolean; logs: string; meta: CommandRunMeta }> {
  if (pm === "yarn") {
    return runCommand("yarn", [script], cwd, config.buildTimeoutMs, previewBuildEnv());
  }
  return runCommand("npm", ["run", script], cwd, config.buildTimeoutMs, previewBuildEnv());
}

async function resolveViteCli(cwd: string): Promise<string | null> {
  for (const name of ["vite", "vite.cmd"]) {
    const p = path.join(cwd, "node_modules", ".bin", name);
    try {
      await fs.access(p);
      return p;
    } catch {
      continue;
    }
  }
  return null;
}

/** Invoke local Vite CLI directly (avoids PATH issues when npm script runs `vite`). */
export async function runViteBuild(
  cwd: string,
  pm: "npm" | "pnpm" | "yarn",
  script = "build",
): Promise<{ ok: boolean; logs: string; meta: CommandRunMeta }> {
  const viteCli = await resolveViteCli(cwd);
  if (viteCli) {
    return runCommand(viteCli, ["build"], cwd, config.buildTimeoutMs, previewBuildEnv());
  }
  return npmRunBuild(cwd, pm, script);
}
