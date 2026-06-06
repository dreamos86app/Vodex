#!/usr/bin/env node
/**
 * End-to-end ZIP import through the real /api/projects/import-zip route.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { ensureDevServerReady, warmDevRoutes } from "./lib/dev-server.mjs";
import { readAuthFile, cookiesHeader } from "./lib/e2e-live.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

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

async function makeFixtureZip() {
  const zip = new JSZip();
  zip.file(
    "package.json",
    JSON.stringify({
      scripts: { dev: "next dev", build: "next build" },
      dependencies: { next: "16.0.0", react: "19.0.0" },
    }),
  );
  zip.file("app/page.tsx", "export default function Page() { return <main>Live route test</main>; }");
  zip.file("src/utils.ts", "export const ok = true;");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  console.log("\n=== verify:zip-import-live-route ===\n");

  const diag = await ensureDevServerReady({
    baseUrl: base,
    startIfDown: true,
    killIfBroken: true,
    root,
  });
  if (diag.state !== "healthy") {
    console.error(`✗ Dev server not healthy: ${diag.message}`);
    console.error("  Run: npm run doctor:dev-server");
    process.exit(1);
  }
  console.log(`[dev-server] ✓ ${diag.message}`);

  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !serviceKey) {
    console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or service role key");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let cookieHeader = null;
  const authFile = readAuthFile();
  if (authFile.ok) {
    cookieHeader = cookiesHeader(authFile.json);
    if (cookieHeader) console.log("✓ Using .playwright-auth.json session");
  }

  if (!cookieHeader) {
    const email = env.E2E_TEST_EMAIL?.trim();
    const password = env.E2E_TEST_PASSWORD?.trim();
    if (!email || !password || !anonKey) {
      console.error(
        "✗ Need .playwright-auth.json or E2E_TEST_EMAIL/E2E_TEST_PASSWORD for live HTTP route test",
      );
      process.exit(1);
    }
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.session) {
      console.error("✗ Auth sign-in failed:", signErr?.message ?? "no session");
      process.exit(1);
    }
    const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
    cookieHeader = `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify(signIn.session))}`;
    console.log("✓ Signed in test user for HTTP route");
  }

  await warmDevRoutes(
    base,
    ["/api/dev/ping", "/api/projects/import-zip"],
    { cookie: cookieHeader ?? undefined, retries: 1 },
  );

  const zipBuf = await makeFixtureZip();
  const form = new FormData();
  form.append("file", new Blob([zipBuf], { type: "application/zip" }), "live-route-fixture.zip");
  form.append("name", "Live Route Fixture");

  const res = await fetch(`${base}/api/projects/import-zip`, {
    method: "POST",
    body: form,
    headers: { Cookie: cookieHeader },
  });

  const body = await res.json();
  if (!res.ok) {
    console.error("✗ Import route failed:", res.status, body.error ?? body);
    if (body.adminDetail) console.error("adminDetail:", JSON.stringify(body.adminDetail, null, 2));
    if (body.devError) console.error("devError:", body.devError);
    process.exit(1);
  }

  const projectId = body.projectId;
  if (!projectId) {
    console.error("✗ Missing projectId in response");
    process.exit(1);
  }
  console.log("✓ Route returned projectId", projectId);

  const { data: project } = await admin.from("projects").select("id,name,owner_id,metadata").eq("id", projectId).single();
  if (!project) {
    console.error("✗ Project row missing");
    process.exit(1);
  }
  console.log("✓ Project row exists");

  const { count: fileCount } = await admin
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (!fileCount || fileCount < 1) {
    console.error("✗ app_files rows missing");
    process.exit(1);
  }
  console.log(`✓ app_files rows inserted (${fileCount})`);

  const { data: sampleFile } = await admin
    .from("app_files")
    .select("owner_id,source,mime_type")
    .eq("project_id", projectId)
    .limit(1)
    .maybeSingle();
  if (!sampleFile?.owner_id) {
    console.error("✗ app_files.owner_id missing on inserted row");
    process.exit(1);
  }
  console.log("✓ app_files.owner_id present");

  const storagePath = `${project.owner_id}/${projectId}/live-route-fixture.zip`;
  const { data: storageList } = await admin.storage.from("zip-imports").list(`${project.owner_id}/${projectId}`);
  if (!storageList?.some((o) => o.name?.includes(".zip"))) {
    console.warn("⚠ zip-imports object not listed (may still exist)");
  } else {
    console.log("✓ zip-imports storage object present");
  }

  const { data: imported } = await admin
    .from("imported_projects")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!imported) {
    console.error("✗ imported_projects row missing");
    process.exit(1);
  }
  console.log("✓ imported_projects row exists");

  if (!body.redirectTo?.includes(projectId)) {
    console.error("✗ redirectTo missing dashboard path");
    process.exit(1);
  }
  console.log("✓ redirectTo returned");

  const outDir = path.join(root, "artifacts", "benchmarks", "p13");
  fs.mkdirSync(outDir, { recursive: true });
  const writeLiveArtifact = (pass, failureReason = null) => {
    fs.writeFileSync(
      path.join(outDir, "live-zip-import.json"),
      JSON.stringify(
        {
          executed: true,
          status: "EXECUTED",
          pass,
          timestamp: new Date().toISOString(),
          environment: { baseUrl: base, e2eRunLive: process.env.E2E_RUN_LIVE === "1" },
          projectId,
          route: "/api/projects/import-zip",
          failureReason,
        },
        null,
        2,
      ),
    );
  };

  const readyRes = await fetch(`${base}/api/projects/${projectId}/publish/readiness`, {
    headers: { Cookie: cookieHeader },
  });
  const readyBody = await readyRes.json();
  if (!readyRes.ok) {
    console.error("✗ publish/readiness failed:", readyRes.status, readyBody);
    process.exit(1);
  }
  console.log(`✓ publish/readiness 200 (files=${readyBody.fileCount}, buildCompleted=${readyBody.buildCompleted})`);

  const filesRes = await fetch(`${base}/api/projects/${projectId}/files`, {
    headers: { Cookie: cookieHeader },
  });
  const filesBody = await filesRes.json();
  if (!filesRes.ok || !filesBody.count) {
    console.error("✗ files API failed:", filesRes.status, filesBody);
    process.exit(1);
  }
  console.log(`✓ files API count=${filesBody.count}`);

  await admin.from("app_files").delete().eq("project_id", projectId);
  await admin.from("imported_projects").delete().eq("project_id", projectId);
  await admin.storage.from("zip-imports").remove([storagePath]).catch(() => {});
  await admin.from("projects").delete().eq("id", projectId);
  console.log("✓ Cleaned up test project");

  writeLiveArtifact(true);

  console.log("\nverify:zip-import-live-route passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
