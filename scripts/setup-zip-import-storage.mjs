#!/usr/bin/env node
/**
 * Ensures the private zip-imports Storage bucket exists (service role).
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

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  const bucketId = "zip-imports";

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    console.error("listBuckets failed:", listErr.message);
    process.exit(1);
  }

  const existing = buckets?.find((b) => b.id === bucketId);
  if (existing) {
    if (existing.public) {
      console.error(`Bucket "${bucketId}" exists but is public — set it to private in Supabase Storage.`);
      process.exit(1);
    }
    console.log(`✓ Bucket "${bucketId}" already exists (private)`);
    process.exit(0);
  }

  const { error: createErr } = await admin.storage.createBucket(bucketId, {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/zip", "application/x-zip-compressed"],
  });

  if (createErr) {
    console.error("createBucket failed:", createErr.message);
    console.error(
      `Also apply migration: supabase/migrations/20260623120000_zip_imports_storage.sql`,
    );
    process.exit(1);
  }

  console.log(`✓ Created private bucket "${bucketId}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
