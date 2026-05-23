#!/usr/bin/env node
/**
 * Compare live app_files schema vs code insert/select contracts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

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

const ZIP_INSERT_KEYS = [
  "project_id",
  "owner_id",
  "path",
  "content",
  "mime_type",
  "size_bytes",
  "source",
];

console.log("\n=== debug:app-files-insert-contract ===\n");
console.log("Supabase URL:", url ?? "(missing)");
console.log("Project ref:", url?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? "(unknown)");
console.log("ZIP import insert keys:", ZIP_INSERT_KEYS.join(", "));

if (!url || !key) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or service role key\n");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const probeSelect = ZIP_INSERT_KEYS.join(", ");
const { error: pgrstErr } = await admin.from("app_files").select(probeSelect).limit(0);

console.log("\nPostgREST-visible columns:", probeSelect);
if (pgrstErr) {
  console.error("✗ PostgREST probe failed:", pgrstErr.message);
  failed = true;
} else {
  console.log("✓ PostgREST sees ZIP import columns");
}

const { data: projects } = await admin.from("projects").select("id,owner_id").limit(1);
const project = projects?.[0];
if (project) {
  const testRow = {
    project_id: project.id,
    owner_id: project.owner_id,
    path: "__contract/diag.ts",
    content: "export {}",
    mime_type: "text/typescript",
    size_bytes: 12,
    source: "zip_import",
  };
  const ins = await admin.from("app_files").upsert(testRow, { onConflict: "project_id,path" });
  if (ins.error) {
    console.error("✗ Live insert contract failed:", ins.error.message);
    failed = true;
  } else {
    console.log("✓ Live insert with ZIP contract succeeded");
    await admin.from("app_files").delete().eq("project_id", project.id).eq("path", "__contract/diag.ts");
  }
} else {
  console.log("⚠ No projects row — skipped live insert probe");
}

const { error: importedProbe } = await admin.from("imported_projects").select("id").limit(0);
if (importedProbe) {
  console.error("✗ imported_projects:", importedProbe.message);
  failed = true;
} else {
  console.log("✓ imported_projects table visible to PostgREST");
}

console.log("");
process.exit(failed ? 1 : 0);
