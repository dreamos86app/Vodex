#!/usr/bin/env node
/**
 * Apply scripts/dreamos-runtime-repair.sql to a Supabase project via Management API.
 *
 * Requires: SUPABASE_ACCESS_TOKEN (from `npx supabase login`)
 * Usage:
 *   node scripts/apply-runtime-repair-remote.mjs --project-ref wciioegiczwqlmlroley
 *   node scripts/apply-runtime-repair-remote.mjs --project-ref wciioegiczwqlmlroley
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "dreamos-runtime-repair.sql");

const ref =
  process.argv.find((a) => a.startsWith("--project-ref="))?.split("=")[1] ??
  process.argv[process.argv.indexOf("--project-ref") + 1];

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (run: npx supabase login)");
  process.exit(1);
}
if (!ref) {
  console.error("Pass --project-ref <ref>");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8").trim();
const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text);
  process.exit(1);
}
console.log("OK — runtime repair applied to", ref);
console.log(text.slice(0, 2000));
