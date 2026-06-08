#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
const p = path.join(root, ".env.local");
if (fs.existsSync(p)) {
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("missing supabase env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb
  .from("projects")
  .select("id, app_name, name, build_status, metadata")
  .or("app_name.ilike.%bidnest%,name.ilike.%bidnest%")
  .limit(5);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));

if (!data?.length) {
  const { data: failed } = await sb
    .from("projects")
    .select("id, app_name, name, build_status")
    .eq("build_status", "preview_failed")
    .order("updated_at", { ascending: false })
    .limit(3);
  console.log("recent preview_failed:", JSON.stringify(failed, null, 2));
}
