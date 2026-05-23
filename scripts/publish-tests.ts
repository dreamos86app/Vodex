#!/usr/bin/env node
/**
 * Publish system fixture tests — run via verify:publish (tsx).
 */
import { checkPublishReadiness } from "../src/lib/publish/publish-readiness";
import {
  slugifyAppName,
  isReservedPublishSlug,
  validateCustomSlug,
  nextSlugCandidate,
} from "../src/lib/publish/app-slug";
import { buildPublicUrl } from "../src/lib/publish/public-url";
import { stripSecretsFromFiles } from "../src/lib/preview/preview-sandbox";
import { wildcardSubdomainEnabled } from "../src/lib/publish/publish-config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const GOOD_FILES = [
  {
    path: "app/page.tsx",
    content: `export default function Page() {
  return (
    <main className="flex flex-col gap-4 p-4 sm:p-6 min-h-screen">
      <nav className="border-b p-4"><a href="/about">About</a></nav>
      <h1 className="text-2xl font-semibold">My SaaS App</h1>
      <div className="card border rounded-lg p-4 shadow-sm">Dashboard</div>
      <button className="bg-slate-900 text-white rounded-lg px-4 py-2" onClick={() => {}}>Get started</button>
      <div className="loading animate-pulse">Loading</div>
      <div className="empty text-sm">No data yet — get started</div>
      <div className="error text-red-600">Something went wrong — try again</div>
    </main>
  );
}`,
  },
  { path: "package.json", content: '{"name":"saas-app","dependencies":{"react":"19"}}' },
];

const PREVIEW_READY_META = {
  preview_ready: true,
  preview_honest: true,
  app_type: "saas_dashboard",
  style_preset_id: "minimal",
};

async function main() {
  // Blocked before generated
  const noFiles = checkPublishReadiness({
    files: [],
    projectId: "p1",
    ownerId: "u1",
    metadata: PREVIEW_READY_META,
  });
  assert(!noFiles.ok, "publish blocked with no files");
  assert(noFiles.blockers.some((b) => /files/i.test(b)), "mentions missing files");

  // Blocked without preview
  const noPreview = checkPublishReadiness({
    files: GOOD_FILES,
    projectId: "p1",
    ownerId: "u1",
    metadata: { app_type: "saas_dashboard" },
  });
  assert(!noPreview.ok, "publish blocked without preview");
  assert(noPreview.blockers.some((b) => /preview/i.test(b)), "mentions preview");

  // Ready with preview + files
  const ready = checkPublishReadiness({
    files: GOOD_FILES,
    projectId: "p1",
    ownerId: "u1",
    metadata: PREVIEW_READY_META,
  });
  assert(ready.routeRenderable, "route renderable");
  assert(Boolean(ready.publicUrl?.includes("/p/")), "path mode public URL");

  // Reserved slug rejected
  assert(isReservedPublishSlug("admin"), "admin reserved");
  const reserved = validateCustomSlug("admin");
  assert(!reserved.ok && reserved.error === "reserved_slug", "custom slug rejects admin");

  // Duplicate slug increment helper
  assert(nextSlugCandidate("my-app", 0) === "my-app", "base slug");
  assert(nextSlugCandidate("my-app", 1) === "my-app-2", "duplicate increment");

  // Path mode default
  process.env.DREAMOS_WILDCARD_SUBDOMAIN = "0";
  process.env.DREAMOS_DNS_VERIFIED = "0";
  const pathUrl = buildPublicUrl("my-crm");
  assert(pathUrl.mode === "path", "path mode default");
  assert(pathUrl.url.includes("/p/my-crm"), "uses /p/slug");
  assert(!pathUrl.url.includes("my-crm.dreamos86.com"), "no fake subdomain");

  // Wildcard only when DNS verified
  process.env.DREAMOS_WILDCARD_SUBDOMAIN = "1";
  process.env.DREAMOS_DNS_VERIFIED = "0";
  assert(!wildcardSubdomainEnabled(), "wildcard off without DNS verify");
  process.env.DREAMOS_DNS_VERIFIED = "1";
  assert(wildcardSubdomainEnabled(), "wildcard on when DNS verified");

  // No secrets in snapshot
  const dirty = [{ path: ".env", content: 'OPENAI_API_KEY="sk_live_abc123"' }];
  const clean = stripSecretsFromFiles(dirty);
  assert(!/sk_live_abc123/.test(clean[0]!.content), "secrets stripped from snapshot");
  assert(/REDACTED/.test(clean[0]!.content), "redacted marker in snapshot");

  // Secrets block publish
  const secretCheck = checkPublishReadiness({
    files: [
      { path: "app/page.tsx", content: "export default () => <div />SUPABASE_SERVICE_ROLE_KEY=secret" },
      { path: "package.json", content: "{}" },
    ],
    projectId: "p1",
    ownerId: "u1",
    metadata: PREVIEW_READY_META,
  });
  assert(!secretCheck.secretsOk, "secrets detected");
  assert(!secretCheck.ok, "publish blocked with secrets");

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const pubPage = fs.readFileSync(path.join(root, "src/app/p/[slug]/page.tsx"), "utf8");
  assert(pubPage.includes("notFound()"), "404 unpublished page");
  assert(!pubPage.includes("app_files"), "no live file fallback on public route");

  const complete = fs.readFileSync(
    path.join(root, "src/lib/build/complete-build-with-validation.ts"),
    "utf8",
  );
  assert(complete.includes('lifecycle = "generated"'), "build does not fake publish");

  console.log("publish fixture tests ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
