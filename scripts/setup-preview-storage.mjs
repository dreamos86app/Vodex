#!/usr/bin/env node
/**
 * Ensures private preview-artifacts and preview-sources Storage buckets exist.
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

async function ensureBucket(admin, bucketId, opts) {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) throw new Error(`listBuckets: ${listErr.message}`);
  const existing = buckets?.find((b) => b.id === bucketId);
  if (existing) {
    if (existing.public) {
      throw new Error(`Bucket "${bucketId}" exists but is public — set private in Supabase.`);
    }
    console.log(`✓ Bucket "${bucketId}" already exists (private)`);
    return;
  }
  const { error: createErr } = await admin.storage.createBucket(bucketId, opts);
  if (createErr) throw new Error(`createBucket ${bucketId}: ${createErr.message}`);
  console.log(`✓ Created private bucket "${bucketId}"`);
}

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

  await ensureBucket(admin, "preview-artifacts", {
    public: false,
    fileSizeLimit: 500 * 1024 * 1024,
  });
  await ensureBucket(admin, "preview-sources", {
    public: false,
    fileSizeLimit: 250 * 1024 * 1024,
    allowedMimeTypes: ["application/zip", "application/x-zip-compressed"],
  });

  console.log("\nPreview storage ready. Ensure Railway worker has matching bucket env vars.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
