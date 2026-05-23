#!/usr/bin/env node
/**
 * Verifies ZIP import storage bucket wiring and (when creds exist) live bucket state.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];
const BUCKET = "zip-imports";

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

mustInclude("src/lib/import/zip-storage.ts", 'ZIP_IMPORT_BUCKET = "zip-imports"', "bucket constant");
mustInclude("src/lib/import/zip-storage.ts", "buildZipImportStoragePath", "owner-scoped path");
mustInclude("src/lib/supabase/ensure-storage-bucket.ts", "ensurePrivateBucket", "private bucket ensure");
mustInclude("src/app/api/projects/import-zip/route.ts", "ZIP_IMPORT_BUCKET", "import route bucket");
mustInclude("src/app/api/projects/import-zip/route.ts", "ensurePrivateBucket", "import route ensure");
mustInclude("src/app/api/projects/import-zip/route.ts", "IMPORT_STORAGE_NOT_CONFIGURED", "setup error code");
mustInclude(
  "src/app/api/projects/import-zip/route.ts",
  "importStorageNotConfiguredUserMessage",
  "user-safe storage error",
);

const migration = path.join(root, "supabase/migrations/20260623120000_zip_imports_storage.sql");
if (fs.existsSync(migration)) ok.push("zip-imports migration present");
else errors.push("missing zip-imports migration");

const route = fs.readFileSync(path.join(root, "src/app/api/projects/import-zip/route.ts"), "utf8");
if (route.includes('.from("media")')) errors.push("import route must not use media bucket");
else ok.push("import route does not use media bucket");

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;

if (url && key) {
  try {
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    if (listErr) {
      errors.push(`live bucket list failed: ${listErr.message}`);
    } else {
      const bucket = buckets?.find((b) => b.id === BUCKET);
      if (!bucket) {
        errors.push(`live: bucket "${BUCKET}" not found — run npm run setup:zip-import-storage`);
      } else {
        ok.push(`live: bucket "${BUCKET}" exists`);
        if (bucket.public) errors.push(`live: bucket "${BUCKET}" must be private`);
        else ok.push(`live: bucket "${BUCKET}" is private`);
      }
    }
  } catch (e) {
    errors.push(`live storage check error: ${e instanceof Error ? e.message : String(e)}`);
  }
} else {
  ok.push("live bucket check skipped (no service role in env)");
}

console.log("\n=== verify:storage ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
