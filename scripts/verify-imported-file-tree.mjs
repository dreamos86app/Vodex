#!/usr/bin/env node
/**
 * Imported file tree architecture + optional live large-ZIP proof.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { devServerBaseUrl, diagnoseDevServer } from "./lib/dev-server.mjs";
import { readAuthFile, cookiesHeader } from "./lib/e2e-live.mjs";

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

async function makeLargeViteFixtureZip(fileCount = 1100) {
  const zip = new JSZip();
  zip.file(
    "package.json",
    JSON.stringify({
      name: "large-vite-fixture",
      scripts: { dev: "vite", build: "vite build" },
      dependencies: { react: "19.0.0", "react-dom": "19.0.0", vite: "6.0.0" },
    }),
  );
  zip.file("index.html", '<!doctype html><html><body><div id="root"></div></body></html>');
  zip.file("src/main.tsx", 'import App from "./App";\nexport default App;');
  zip.file("src/App.tsx", "export default function App() { return <main>Large fixture</main>; }");
  for (let i = 0; i < fileCount; i++) {
    zip.file(`src/modules/mod-${String(i).padStart(4, "0")}.ts`, `export const n${i} = ${i};`);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function runLiveLargeZipTest() {
  const base = devServerBaseUrl();
  const diag = await diagnoseDevServer(base);
  if (diag.state !== "healthy") {
    console.log(`⚠ Skipping live large-ZIP test (${diag.message})`);
    return true;
  }

  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey) {
    console.warn("⚠ Skipping live large-ZIP test (missing Supabase env)");
    return true;
  }

  let cookieHeader = null;
  const authFile = readAuthFile();
  if (authFile.ok) cookieHeader = cookiesHeader(authFile.json);
  if (!cookieHeader) {
    const email = env.E2E_TEST_EMAIL?.trim();
    const password = env.E2E_TEST_PASSWORD?.trim();
    if (!email || !password || !anonKey) {
      console.warn("⚠ Skipping live large-ZIP test (no auth)");
      return true;
    }
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.session) {
      console.warn("⚠ Skipping live large-ZIP test (auth failed)");
      return true;
    }
    const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
    cookieHeader = `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify(signIn.session))}`;
  }

  const expectedFiles = 1104;
  const zipBuf = await makeLargeViteFixtureZip(1100);
  const form = new FormData();
  form.append("file", new Blob([zipBuf], { type: "application/zip" }), "large-vite-fixture.zip");
  form.append("name", "Large Vite Fixture");

  const res = await fetch(`${base}/api/projects/import-zip`, {
    method: "POST",
    body: form,
    headers: { Cookie: cookieHeader },
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("✗ Large ZIP import failed:", res.status, body.error ?? body);
    return false;
  }

  const projectId = body.projectId;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count: dbCount } = await admin
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("source", "zip_import");

  const filesRes = await fetch(`${base}/api/projects/${projectId}/files`, {
    headers: { Cookie: cookieHeader },
  });
  const filesBody = await filesRes.json();

  const contentRes = await fetch(`${base}/api/projects/${projectId}/files?path=${encodeURIComponent("package.json")}`, {
    headers: { Cookie: cookieHeader },
  });
  const contentBody = await contentRes.json();

  let ok = true;
  if (!dbCount || dbCount < 1000) {
    console.error(`✗ app_files count too low: ${dbCount}`);
    ok = false;
  } else {
    console.log(`✓ app_files zip_import count=${dbCount}`);
  }

  if (!filesRes.ok || !filesBody.count || filesBody.count < 1000) {
    console.error(`✗ files API count too low: ${filesBody.count}`);
    ok = false;
  } else {
    console.log(`✓ files API count=${filesBody.count} (expected ~${expectedFiles})`);
  }

  if (dbCount !== filesBody.count) {
    console.error(`✗ DB count (${dbCount}) != API count (${filesBody.count})`);
    ok = false;
  } else {
    console.log("✓ DB count matches API count");
  }

  if (!contentRes.ok || !contentBody.file?.content?.includes("large-vite-fixture")) {
    console.error("✗ lazy file content load failed for package.json");
    ok = false;
  } else {
    console.log("✓ lazy file content load works");
  }

  const { data: sample } = await admin
    .from("app_files")
    .select("source")
    .eq("project_id", projectId)
    .limit(1)
    .maybeSingle();
  if (sample?.source !== "zip_import") {
    console.error("✗ source is not zip_import");
    ok = false;
  } else {
    console.log("✓ source=zip_import");
  }

  await admin.from("app_files").delete().eq("project_id", projectId);
  await admin.from("imported_projects").delete().eq("project_id", projectId);
  await admin.from("projects").delete().eq("id", projectId);
  console.log("✓ Cleaned up large fixture project");

  return ok;
}

async function main() {
  console.log("\n=== verify:imported-file-tree ===\n");

  const checks = [
    ["src/lib/projects/load-project-files.ts", "loadProjectFilePaths"],
    ["src/app/api/projects/[id]/files/route.ts", "Paginated files API"],
    ["src/components/builder/app-builder-workspace.tsx", "Lazy content load"],
    ["src/components/create/workspace/immersive-workspace.tsx", "loadProjectFilePaths import"],
    ["src/lib/import/detect-app-icon.ts", "Icon detection"],
  ];

  let failed = false;
  for (const [file, label] of checks) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) {
      console.error("✗ missing", file);
      failed = true;
    } else {
      console.log("✓", label);
    }
  }

  const load = fs.readFileSync(path.join(root, "src/lib/projects/load-project-files.ts"), "utf8");
  if (!load.includes("PAGE = 1000")) {
    console.error("✗ pagination constant");
    failed = true;
  } else console.log("✓ file path pagination");

  const api = fs.readFileSync(path.join(root, "src/app/api/projects/[id]/files/route.ts"), "utf8");
  if (!api.includes("zip_import")) {
    console.warn("⚠ files route documents zip_import sources");
  }
  if (!api.includes("range(from")) {
    console.error("✗ files API paginates");
    failed = true;
  } else console.log("✓ files API paginates");

  const builder = fs.readFileSync(path.join(root, "src/components/builder/app-builder-workspace.tsx"), "utf8");
  if (!builder.includes("loadProjectFileContent") && !builder.includes("?path=")) {
    console.error("✗ builder missing lazy content fetch");
    failed = true;
  } else console.log("✓ builder lazy content fetch");

  console.log("\n--- live large-ZIP (optional) ---\n");
  const liveOk = await runLiveLargeZipTest();
  if (!liveOk) failed = true;

  if (failed) {
    console.error("\nverify:imported-file-tree failed.\n");
    process.exit(1);
  }
  console.log("\nverify:imported-file-tree passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
