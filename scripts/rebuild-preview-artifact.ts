#!/usr/bin/env npx tsx
/**
 * Re-queue preview build using canonical import pipeline (not raw job insert).
 * Usage: npm run rebuild:preview-artifact -- --project <uuid>
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runProjectPreviewBuild } from "../src/lib/imports/run-project-preview-build";

const root = process.cwd();

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

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const projectId = arg("--project", "e688141b-13ff-4126-a301-787bd39a5d2c");

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: project, error: projErr } = await admin
    .from("projects")
    .select("id, owner_id, name, metadata")
    .eq("id", projectId)
    .maybeSingle();

  if (projErr || !project?.owner_id) {
    console.error("Project not found or missing owner_id:", projErr?.message ?? "no row");
    process.exit(1);
  }

  const { count } = await admin
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (!count) {
    console.error("No app_files rows — import ZIP sources first.");
    process.exit(1);
  }

  console.log(`Rebuilding preview for ${project.name ?? projectId} (owner ${project.owner_id})…`);

  const { diagnostics, jobId } = await runProjectPreviewBuild({
    admin,
    writer: admin,
    userId: project.owner_id,
    projectId,
  });

  console.log(`✓ Queued preview build job ${jobId}`);
  console.log(`  status: ${diagnostics.previewStatus}`);
  console.log(`  renderable: ${diagnostics.previewRenderable}`);
  if (diagnostics.blockedReason) console.log(`  blocked: ${diagnostics.blockedReason}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
