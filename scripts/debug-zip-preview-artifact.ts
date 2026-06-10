#!/usr/bin/env npx tsx
/**
 * Full ZIP preview artifact leak debugger.
 * Usage: npm run debug:zip-preview-artifact -- --project <uuid>
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { scanTextForPathLeaks, TEXT_ARTIFACT_EXT } from "../src/lib/preview/preview-path-leak-scanner";

const root = path.join(process.cwd());

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const projectId = arg("--project", "e688141b-13ff-4126-a301-787bd39a5d2c");

async function listAllFiles(
  admin: ReturnType<typeof createClient<any>>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  async function walk(folder: string) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 500 });
    if (error || !data) return;
    for (const ent of data) {
      const rel = folder ? `${folder}/${ent.name}` : ent.name;
      if (ent.id == null) await walk(rel);
      else out.push(rel);
    }
  }
  await walk(prefix);
  return out;
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: project } = await admin
    .from("projects")
    .select("id, name, preview_url, metadata, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  console.log("ZIP Preview Artifact Debug Report");
  console.log("==================================");
  console.log(`project_id: ${projectId}`);
  if (!project) {
    console.error("Project not found");
    process.exit(1);
  }

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  console.log(`preview_url: ${project.preview_url ?? "(null)"}`);
  console.log(`preview_artifact_path: ${meta.preview_artifact_path ?? "(null)"}`);
  console.log(`preview_renderable: ${meta.preview_renderable ?? "(null)"}`);
  console.log(`preview_job_id: ${meta.preview_job_id ?? "(null)"}`);

  const { data: jobs } = await admin
    .from("preview_build_jobs")
    .select("id, status, artifact_path, blocked_reason, created_at, framework")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("\nLatest preview_build_jobs:");
  for (const j of jobs ?? []) {
    console.log(`  - ${j.id} status=${j.status} artifact=${j.artifact_path ?? "—"} blocked=${j.blocked_reason ?? "—"}`);
  }

  const artifactPath =
    (typeof meta.preview_artifact_path === "string" && meta.preview_artifact_path) ||
    jobs?.[0]?.artifact_path ||
    `${projectId}/${jobs?.[0]?.id ?? "unknown"}`;

  console.log(`\nScanning bucket preview-artifacts prefix: ${artifactPath}`);

  const files = await listAllFiles(admin, "preview-artifacts", artifactPath);
  console.log(`artifact_files: ${files.length}`);

  let unsafeTotal = 0;
  const unsafeFiles: string[] = [];

  for (const rel of files) {
    if (!TEXT_ARTIFACT_EXT.test(rel)) continue;
    const storagePath = `${artifactPath}/${rel}`.replace(/\/+/g, "/").replace(`${artifactPath}/${artifactPath}/`, `${artifactPath}/`);
    const fullPath = rel.startsWith(artifactPath) ? rel : `${artifactPath}/${rel}`;
    const { data, error } = await admin.storage.from("preview-artifacts").download(fullPath);
    if (error || !data) continue;
    const text = await data.text();
    const leaks = scanTextForPathLeaks(text, projectId).filter((l) => !l.safe);
    if (leaks.length) {
      unsafeTotal += leaks.length;
      unsafeFiles.push(fullPath);
      console.log(`\n[UNSAFE] ${fullPath}`);
      for (const leak of leaks.slice(0, 5)) {
        console.log(`  pattern: ${leak.pattern}`);
        console.log(`  snippet: ${leak.snippet}`);
        console.log(`  repair: ${leak.repair}`);
      }
      if (leaks.length > 5) console.log(`  ... +${leaks.length - 5} more`);
    }
  }

  if (unsafeTotal === 0) {
    console.log("\n✓ No unsafe platform path leaks found in scanned artifact text files.");
  } else {
    console.log(`\n✗ Found ${unsafeTotal} unsafe leak(s) across ${unsafeFiles.length} file(s).`);
    console.log("Repair: redeploy worker + platform, then npm run rebuild:preview-artifact");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
