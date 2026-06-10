#!/usr/bin/env node
/**
 * Re-queue preview build for a project (e.g. reciplyy1 after worker deploy).
 * Usage: node scripts/rebuild-preview-artifact.mjs --project <uuid>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const projectId = process.argv.includes("--project")
  ? process.argv[process.argv.indexOf("--project") + 1]
  : "e688141b-13ff-4126-a301-787bd39a5d2c";

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: job, error } = await admin
    .from("preview_build_jobs")
    .insert({
      project_id: projectId,
      status: "queued",
      priority: 10,
      source: "manual_rebuild",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to queue job:", error.message);
    process.exit(1);
  }
  console.log(`✓ Queued preview build job ${job.id} for project ${projectId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
