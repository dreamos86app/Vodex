#!/usr/bin/env node
/**
 * Backfill preview_renderable / preview_status / session linkage when provably correct.
 * Default: dry run. Pass --apply to write updates.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
const outDir = path.join(root, "artifacts", "benchmarks", "p13");

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

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

function metaOf(row) {
  const m = row?.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? m : {};
}

async function main() {
  console.log(`\n=== repair:preview-metadata (${apply ? "APPLY" : "DRY RUN"}) ===\n`);

  let projects;
  try {
    const res = await admin
      .from("projects")
      .select("id, owner_id, preview_url, metadata, build_status")
      .limit(5000);
    if (res.error) throw new Error(res.error.message);
    projects = res.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const report = {
      generatedAt: new Date().toISOString(),
      mode: apply ? "apply" : "dry_run",
      status: "NOT_EXECUTED",
      error: msg,
      reason: "Supabase unreachable from this environment",
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "preview-metadata-repair.json"), JSON.stringify(report, null, 2));
    console.error(`\n✗ repair:preview-metadata NOT_EXECUTED — ${msg}\n`);
    process.exit(1);
  }

  const candidates = [];
  for (const p of projects ?? []) {
    const meta = metaOf(p);
    const sessionId =
      typeof meta.last_preview_session_id === "string"
        ? meta.last_preview_session_id
        : typeof meta.preview_session_id === "string"
          ? meta.preview_session_id
          : null;

    if (meta.preview_ready === true && meta.preview_renderable !== true && !sessionId) {
      candidates.push({
        projectId: p.id,
        ownerId: p.owner_id,
        sessionId: null,
        before: {
          preview_ready: meta.preview_ready,
          preview_renderable: meta.preview_renderable ?? null,
          preview_status: meta.preview_status ?? null,
        },
        after: {
          preview_ready: false,
          preview_honest: false,
          preview_renderable: false,
          preview_status: "not_started",
          preview_failure_kind: "no_preview_job",
          preview_failure_detail:
            "No preview session was created after source files were saved.",
        },
      });
      continue;
    }

    if (!sessionId) continue;
    if (meta.preview_renderable === true && meta.preview_status === "ready") continue;

    const { data: session } = await admin
      .from("preview_sessions")
      .select("id, status, project_id")
      .eq("id", sessionId)
      .eq("project_id", p.id)
      .maybeSingle();

    if (!session || session.status !== "ready") continue;

    const patch = {
      preview_renderable: true,
      preview_honest: true,
      preview_ready: true,
      preview_status: "ready",
      preview_session_id: sessionId,
      preview_job_id: sessionId,
      last_preview_session_id: sessionId,
    };

    candidates.push({
      projectId: p.id,
      ownerId: p.owner_id,
      sessionId,
      before: {
        preview_renderable: meta.preview_renderable ?? null,
        preview_status: meta.preview_status ?? null,
      },
      after: patch,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry_run",
    scannedProjects: (projects ?? []).length,
    repairCandidates: candidates.length,
    candidates: candidates.slice(0, 50),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "preview-metadata-repair.json"), JSON.stringify(report, null, 2));

  console.log(`Scanned ${report.scannedProjects} projects`);
  console.log(`Repair candidates: ${report.repairCandidates}`);

  if (candidates.length === 0) {
    console.log("\n✓ Nothing to backfill\n");
    return;
  }

  if (!apply) {
    console.log("\nDry run only — pass --apply to write metadata patches\n");
    for (const c of candidates.slice(0, 10)) {
      console.log(`  ${c.projectId} session=${c.sessionId}`);
    }
    return;
  }

  let updated = 0;
  for (const c of candidates) {
    const { data: cur } = await admin
      .from("projects")
      .select("metadata")
      .eq("id", c.projectId)
      .maybeSingle();
    const meta = metaOf(cur);
    const { error: upErr } = await admin
      .from("projects")
      .update({
        metadata: { ...meta, ...c.after },
      })
      .eq("id", c.projectId)
      .eq("owner_id", c.ownerId);
    if (!upErr) updated += 1;
  }

  report.applied = updated;
  fs.writeFileSync(path.join(outDir, "preview-metadata-repair.json"), JSON.stringify(report, null, 2));
  console.log(`\n✓ Applied ${updated} metadata patches\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
