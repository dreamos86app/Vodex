import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);

export type GradleBuildResult =
  | { ok: true; artifactPath: string; byteSize: number; logs: string }
  | { ok: false; error: string; logs: string };

export async function extractWrapperZip(zipBuffer: Buffer, workspace: string): Promise<void> {
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const dest = path.join(workspace, entry.name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const content = await entry.async("nodebuffer");
    await fs.writeFile(dest, content);
  }
}

function gradleTask(buildType: "apk" | "aab"): string {
  return buildType === "aab" ? "bundleRelease" : "assembleRelease";
}

async function findArtifact(androidDir: string, buildType: "apk" | "aab"): Promise<string | null> {
  const releaseDir = path.join(androidDir, "app", "build", "outputs");
  const ext = buildType === "aab" ? ".aab" : ".apk";
  async function walk(dir: string): Promise<string | null> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        const found = await walk(p);
        if (found) return found;
      } else if (e.name.endsWith(ext) && !e.name.includes("unsigned")) {
        return p;
      }
    }
    return null;
  }
  return walk(releaseDir);
}

export async function runGradleBuild(input: {
  workspace: string;
  buildType: "apk" | "aab";
}): Promise<GradleBuildResult> {
  if (!config.androidHome) {
    return {
      ok: false,
      error: "ANDROID_HOME / ANDROID_SDK_ROOT not configured — cannot run Gradle",
      logs: "Builder requires Android SDK on the host.",
    };
  }

  const androidDir = path.join(input.workspace, "android");
  try {
    await fs.access(path.join(androidDir, "gradlew"));
  } catch {
    return {
      ok: false,
      error: "No android/gradlew in wrapper project",
      logs: "Capacitor android folder missing from wrapper ZIP.",
    };
  }

  const gradlew = process.platform === "win32" ? "gradlew.bat" : "gradlew";
  const task = gradleTask(input.buildType);
  const env = {
    ...process.env,
    ANDROID_HOME: config.androidHome,
    ANDROID_SDK_ROOT: config.androidHome,
    ...(config.javaHome ? { JAVA_HOME: config.javaHome } : {}),
  };

  const logs: string[] = [`./${gradlew} ${task}`];
  try {
    const { stdout, stderr } = await execFileAsync(
      path.join(androidDir, gradlew),
      [task, "--no-daemon", "-x", "lint"],
      { cwd: androidDir, env, maxBuffer: 20 * 1024 * 1024 },
    );
    logs.push(stdout, stderr);
  } catch (e) {
    const err = e as { message?: string; stdout?: string; stderr?: string };
    logs.push(err.stdout ?? "", err.stderr ?? "", err.message ?? "Gradle failed");
    return { ok: false, error: err.message ?? "Gradle build failed", logs: logs.join("\n") };
  }

  const artifactPath = await findArtifact(androidDir, input.buildType);
  if (!artifactPath) {
    return {
      ok: false,
      error: `No ${input.buildType.toUpperCase()} artifact found after Gradle`,
      logs: logs.join("\n"),
    };
  }

  const stat = await fs.stat(artifactPath);
  if (stat.size <= 0) {
    return { ok: false, error: "Artifact size is zero", logs: logs.join("\n") };
  }

  return { ok: true, artifactPath, byteSize: stat.size, logs: logs.join("\n") };
}
