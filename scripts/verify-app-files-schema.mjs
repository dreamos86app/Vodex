#!/usr/bin/env node
/**
 * Verifies app_files schema matches builder/ZIP import expectations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];
const REQUIRED_COLUMNS = ["mime_type", "size_bytes", "source"];

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

function mustInclude(rel, needle, label) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${rel}`);
    return;
  }
  const src = fs.readFileSync(full, "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustInclude("src/lib/projects/app-file-rows.ts", "buildZipImportAppFileRows", "zip import row builder");
mustInclude("src/lib/projects/app-file-rows.ts", "zip_import", "zip_import source");
mustInclude("src/app/api/projects/import-zip/route.ts", "buildZipImportAppFileRows", "import uses row builder");
mustInclude("src/app/api/projects/import-zip/route.ts", "owner_id", "import includes owner_id");
mustInclude("src/app/api/projects/import-zip/route.ts", "formatZipImportFailure", "import failure diagnostics");
mustInclude("src/lib/projects/app-file-rows.ts", "owner_id", "row builder owner_id");

const migration = path.join(root, "supabase/migrations/20260623130000_app_files_import_metadata.sql");
if (fs.existsSync(migration)) ok.push("app_files metadata migration present");
else errors.push("missing app_files metadata migration");

for (const col of REQUIRED_COLUMNS) {
  if (fs.readFileSync(migration, "utf8").includes(col)) ok.push(`migration adds ${col}`);
  else errors.push(`migration missing ${col}`);
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;

if (url && key) {
  try {
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const probe = await admin
      .from("app_files")
      .select("id, project_id, path, content, mime_type, size_bytes, source")
      .limit(0);

    if (probe.error) {
      if (/mime_type|schema cache|column/i.test(probe.error.message)) {
        errors.push(
          `live: PostgREST missing app_files metadata columns — apply migration and reload schema`,
        );
      } else {
        errors.push(`live: app_files probe failed: ${probe.error.message}`);
      }
    } else {
      ok.push("live: PostgREST sees app_files.mime_type, size_bytes, source");
    }
  } catch (e) {
    errors.push(`live schema check error: ${e instanceof Error ? e.message : String(e)}`);
  }
} else {
  ok.push("live schema check skipped (no service role in env)");
}

console.log("\n=== verify:app-files-schema ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
