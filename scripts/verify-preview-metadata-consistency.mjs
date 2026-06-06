#!/usr/bin/env node
/**
 * Fail when project metadata would produce unknown preview panel fields.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const structuralErrors = [];
for (const [rel, needle] of [
  ["src/lib/preview/preview-metadata.ts", "canonicalPreviewReadyMetadata"],
  ["src/lib/preview/derive-preview-failure.ts", "no_preview_job"],
  ["src/components/create/workspace/preview-runtime-status-panel.tsx", "preview-start-button"],
]) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) {
    structuralErrors.push(`missing ${rel}: ${needle}`);
  }
}

async function main() {
  console.log("\n=== verify:preview-metadata-consistency ===\n");

  const report = {
    generatedAt: new Date().toISOString(),
    executed: true,
    pass: structuralErrors.length === 0,
    structuralErrors,
    dbViolations: [],
    scanned: 0,
  };

  if (!url || !key) {
    report.pass = structuralErrors.length === 0;
    report.dbSkipped = "SUPABASE_SERVICE_ROLE_KEY missing";
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "preview-metadata-consistency.json"), JSON.stringify(report, null, 2));
    if (structuralErrors.length) {
      structuralErrors.forEach((e) => console.error(`✗ ${e}`));
      process.exit(1);
    }
    console.log("✓ structural checks only (no DB)");
    process.exit(0);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: projects, error } = await admin
    .from("projects")
    .select("id, metadata, preview_url")
    .limit(2000);

  if (error) {
    report.pass = false;
    report.dbError = error.message;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "preview-metadata-consistency.json"), JSON.stringify(report, null, 2));
    console.error(`✗ DB scan failed: ${error.message}`);
    process.exit(1);
  }

  report.scanned = projects?.length ?? 0;

  for (const p of projects ?? []) {
    const m = p.metadata && typeof p.metadata === "object" ? p.metadata : {};
    if (m.preview_ready === true) {
      if (m.preview_renderable !== true) {
        report.dbViolations.push({ projectId: p.id, issue: "preview_ready_without_renderable" });
      }
      if (m.preview_status !== "ready") {
        report.dbViolations.push({ projectId: p.id, issue: "preview_ready_status_not_ready" });
      }
      const hasRef =
        typeof m.preview_session_id === "string" ||
        typeof m.preview_job_id === "string" ||
        typeof m.last_preview_session_id === "string" ||
        typeof m.preview_artifact_path === "string" ||
        Boolean(p.preview_url);
      if (!hasRef) {
        report.dbViolations.push({ projectId: p.id, issue: "preview_ready_without_session_or_artifact" });
      }
    }
    if (m.preview_renderable === true && m.preview_ready !== true) {
      report.dbViolations.push({ projectId: p.id, issue: "renderable_without_preview_ready" });
    }
  }

  report.pass = structuralErrors.length === 0 && report.dbViolations.length === 0;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "preview-metadata-consistency.json"), JSON.stringify(report, null, 2));

  if (report.pass) {
    console.log(`✓ ${report.scanned} projects scanned — no metadata consistency violations`);
    process.exit(0);
  }

  structuralErrors.forEach((e) => console.error(`✗ ${e}`));
  for (const v of report.dbViolations.slice(0, 10)) {
    console.error(`✗ ${v.projectId}: ${v.issue}`);
  }
  if (report.dbViolations.length > 10) {
    console.error(`  … and ${report.dbViolations.length - 10} more`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
