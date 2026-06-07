#!/usr/bin/env npx tsx
/**
 * P1.3.13 — Repair stale build_status / workflow terminal events from on-disk truth.
 *
 * Usage:
 *   npm run repair:build-state-truth -- --project <uuid>
 *   npm run repair:build-state-truth -- --project <uuid> --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectBuildStateTruth,
  repairBuildStateTruth,
} from "../src/lib/build/build-state-truth-repair";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
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

async function main() {
  const projectId = arg("--project");
  if (!projectId) {
    console.error("Usage: npm run repair:build-state-truth -- --project <uuid> [--dry-run]");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project?.owner_id) {
    console.error("Project not found:", projectId);
    process.exit(1);
  }

  const before = await inspectBuildStateTruth(admin, projectId, project.owner_id);
  console.log("\n=== BEFORE ===");
  console.log(JSON.stringify(before, null, 2));

  const result = await repairBuildStateTruth(admin, projectId, project.owner_id, {
    apply: !dryRun,
    startPreview: !dryRun,
  });

  console.log("\n=== AFTER ===");
  console.log(JSON.stringify(result.debug, null, 2));
  console.log("\n=== RESOLVED ===");
  console.log(
    JSON.stringify(
      {
        applied: result.applied,
        build_status: result.resolved.buildStatus,
        job_status: result.resolved.jobStatus,
        failure_kind: result.resolved.failureKind,
        headline: result.resolved.headline,
        preview_start_attempted: result.previewStartAttempted,
        preview_start_ok: result.previewStartOk,
      },
      null,
      2,
    ),
  );

  const outDir = path.join(root, "artifacts", "benchmarks", "p1313");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `repair-${projectId}.json`),
    JSON.stringify({ before, after: result }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
