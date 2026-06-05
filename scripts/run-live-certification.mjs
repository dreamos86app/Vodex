#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function extractProjectRefFromJwt(jwt) {
  if (!jwt) return null;
  const parts = jwt.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ref = extractProjectRefFromJwt(key);
const url =
  ref && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(`${ref}.supabase.co`)
    ? `https://${ref}.supabase.co`
    : process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const projectId = process.env.E2E_RECIPLY_PROJECT_ID ?? "59bf67fb-2203-4f3a-82e7-07f31a7dc4ad";

let { data: project, error: byIdErr } = await admin
  .from("projects")
  .select("id, owner_id, name")
  .eq("id", projectId)
  .maybeSingle();

if (!project) {
  const { data: rows, error: searchErr } = await admin
    .from("projects")
    .select("id, owner_id, name")
    .ilike("name", "%reciply%")
    .limit(5);
  if (!rows?.length) {
    console.error(JSON.stringify({ byIdErr: byIdErr?.message, searchErr: searchErr?.message, urlHost: new URL(url).hostname }));
    process.exit(1);
  }
  project = rows[0];
}

const runner = path.join(root, "scripts", ".live-cert-run.ts");
fs.writeFileSync(
  runner,
  `import { runProductionCertification } from "../src/lib/certification/run-production-certification";
const result = await runProductionCertification({ projectId: ${JSON.stringify(project.id)}, ownerId: ${JSON.stringify(project.owner_id)} });
if ("error" in result) { console.log(JSON.stringify({ error: result.error })); process.exit(1); }
const blockers = result.sections.flatMap((s) => s.checks.filter((c) => c.status === "blocker").map((c) => ({ section: s.id, id: c.id, title: c.title, detail: c.detail })));
const warnings = result.sections.flatMap((s) => s.checks.filter((c) => c.status === "warning").map((c) => ({ section: s.id, id: c.id, title: c.title, detail: c.detail })));
console.log(JSON.stringify({ project: ${JSON.stringify(project.name)}, overall_score: result.overall_score, level: result.certification_level, passed: result.passed_checks, warnings_count: result.warnings, blockers_count: result.blockers, blockers, warnings }, null, 2));
`,
);

const r = spawnSync("npx", ["tsx", runner], { cwd: root, shell: true, encoding: "utf8", env: process.env });
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
try {
  fs.unlinkSync(runner);
} catch {
  /* ignore */
}
process.exit(r.status ?? 1);
