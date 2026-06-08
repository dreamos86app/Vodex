#!/usr/bin/env npx tsx
/**
 * Verify debug:preview-failure CLI is free of Next server-only import chain.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const forbiddenInScript = [
  "server-only",
  "load-preview-runtime-status",
  "runtime-build-runner",
  "debug-preview-failure.ts",
  "project-preview-html",
];

const scriptSrc = read("scripts/debug-preview-failure.ts");
const cliSrc = read("src/lib/preview/debug-preview-failure-cli.ts");

if (/from\s+["'][^"']*\/debug-preview-failure["'];?/.test(scriptSrc)) {
  fail("script still imports Next-bound debug-preview-failure.ts");
}
for (const needle of forbiddenInScript) {
  if (needle === "debug-preview-failure.ts") continue;
  if (scriptSrc.includes(needle)) {
    fail(`scripts/debug-preview-failure.ts imports forbidden: ${needle}`);
  }
}
const cliImports = cliSrc
  .split("\n")
  .filter((l) => /^\s*import\s/.test(l))
  .join("\n");
if (
  cliImports.includes("server-only") ||
  cliImports.includes("runtime-build-runner") ||
  cliImports.includes("load-preview-runtime-status") ||
  cliImports.includes("project-preview-html")
) {
  fail("debug-preview-failure-cli.ts imports server-only chain");
}

if (!scriptSrc.includes("debug-preview-failure-cli")) {
  fail("script must import debug-preview-failure-cli");
}

if (!cliSrc.includes("classifyPreviewBuildFailure")) {
  fail("CLI loader must use preview-failure-classifier");
}

// --help must exit 0 without module resolution errors
try {
  const helpOut = execSync("npx tsx scripts/debug-preview-failure.ts --help", {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (!helpOut.includes("--project")) fail("--help output missing --project");
} catch (e) {
  fail(`--help crashed: ${e instanceof Error ? e.message : e}`);
}

// Missing --project must exit 1 gracefully (not module error)
try {
  execSync("npx tsx scripts/debug-preview-failure.ts", {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  fail("missing --project should exit non-zero");
} catch (e: unknown) {
  const err = e as { status?: number; stderr?: string; stdout?: string };
  const combined = `${err.stderr ?? ""}${err.stdout ?? ""}`;
  if (/Cannot find module|server-only/i.test(combined)) {
    fail(`module resolution error on missing-args run: ${combined}`);
  }
  if (err.status !== 1) {
    fail(`expected exit 1 for missing --project, got ${err.status}`);
  }
}

// Missing project UUID should not crash from imports (env may be missing — that's ok)
try {
  execSync(
    "npx tsx scripts/debug-preview-failure.ts --project 00000000-0000-0000-0000-000000000000",
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-key",
      },
    },
  );
} catch (e: unknown) {
  const err = e as { stderr?: string; stdout?: string };
  const combined = `${err.stderr ?? ""}${err.stdout ?? ""}`;
  if (/Cannot find module|server-only/i.test(combined)) {
    fail(`module resolution error on missing-project run: ${combined}`);
  }
  // network/auth errors are acceptable — script loaded modules
}

console.log("verify:debug-preview-failure-cli OK");
