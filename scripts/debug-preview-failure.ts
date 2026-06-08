#!/usr/bin/env npx tsx
/**
 * P1.3.15 — Debug preview failure for a project (CLI-safe, no Next server imports).
 *
 * Usage:
 *   npm run debug:preview-failure -- --project <uuid>
 *   npm run debug:preview-failure -- --help
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPreviewFailureCliDebug } from "../src/lib/preview/debug-preview-failure-cli";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal(): Record<string, string> {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) return null;
  return process.argv[i + 1]!;
}

function printHelp() {
  console.log(`debug:preview-failure — inspect preview build failure for a project

Usage:
  npm run debug:preview-failure -- --project <uuid>

Options:
  --project <uuid>   Project ID to inspect
  --help             Show this help

Requires env:
  NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
`);
}

function resolveSupabaseEnv(env: Record<string, string | undefined>): {
  url: string | null;
  key: string | null;
} {
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? null,
    key: env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? null,
  };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const projectId = arg("--project");
  if (!projectId) {
    console.error("Usage: npm run debug:preview-failure -- --project <uuid>");
    console.error("       npm run debug:preview-failure -- --help");
    process.exit(1);
  }

  const env = { ...process.env, ...loadEnvLocal() };
  const { url, key } = resolveSupabaseEnv(env);

  if (!url) {
    console.error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL missing.");
    process.exit(1);
  }
  if (!key) {
    console.error("SUPABASE_SERVICE_ROLE_KEY missing.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const result = await loadPreviewFailureCliDebug(admin, projectId);

  if (!result) {
    console.log(JSON.stringify({ error: "project_not_found", project_id: projectId }, null, 2));
    process.exit(1);
  }

  const { classification: _c, ...output } = result;
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
