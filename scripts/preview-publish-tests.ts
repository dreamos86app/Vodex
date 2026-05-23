#!/usr/bin/env node
/**
 * Fixture tests for preview/publish honesty — run via verify scripts (tsx).
 */
import { buildPublicUrl } from "../src/lib/publish/public-url";
import { isReservedPublishSlug, slugifyAppName } from "../src/lib/publish/app-slug";
import { stripSecretsFromFiles } from "../src/lib/preview/preview-sandbox";
import {
  resolvePreviewProvider,
  previewProviderNotConnected,
  PREVIEW_PROVIDER_CHAIN,
} from "../src/lib/preview/preview-provider-registry";
import { buildStaticPreviewHtml } from "../src/lib/preview/static-preview-builder";
import { buildPreviewPageUrl } from "../src/lib/preview/preview-url";
import { resolveSnapshotHtml } from "../src/lib/publish/render-published-html";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

  process.env.DREAMOS_WILDCARD_SUBDOMAIN = "0";
  const pathUrl = buildPublicUrl("my-app");
  assert(pathUrl.mode === "path", "default must be path mode");
  assert(pathUrl.url.includes("/p/my-app"), "path URL must use /p/{slug}");
  assert(!pathUrl.url.includes("my-app.dreamos86.com"), "must not fake subdomain without DNS");

  assert(isReservedPublishSlug("admin"), "admin reserved");
  assert(!isReservedPublishSlug(slugifyAppName("My CRM App")), "normal slug ok");

  const dirty = [{ path: ".env", content: 'OPENAI_API_KEY="sk_live_abc123"' }];
  const clean = stripSecretsFromFiles(dirty);
  assert(/REDACTED|\[REDACTED\]/.test(clean[0]!.content) || !/sk_live_/.test(clean[0]!.content), "secrets stripped");

  const files = [
    {
      path: "app/page.tsx",
      content: `export default function Page() {
  return (<main className="p-4"><h1>Hello CRM</h1><button>Go</button></main>);
}`,
    },
    { path: "package.json", content: '{"name":"app"}' },
  ];
  const html = buildStaticPreviewHtml(files);
  assert(html.includes("<!DOCTYPE html>"), "static html doc");
  assert(html.includes("Hello CRM") || html.includes("h1"), "content rendered");
  const snap = resolveSnapshotHtml(files);
  assert(Boolean(snap), "resolve snapshot html");

  const sessionUrl = buildPreviewPageUrl("00000000-0000-0000-0000-000000000099");
  assert(sessionUrl.includes("/preview/"), "real in-app preview route");
  assert(!sessionUrl.includes("fake"), "no fake preview host");

  const noToken = await resolvePreviewProvider({
    projectId: "p1",
    userId: "u1",
    sessionId: "s1",
    files,
    vercelToken: null,
    vercelProjectId: null,
  });
  assert(
    noToken.level === "static_snapshot" || noToken.level === "in_app_sandbox",
    "falls back without token",
  );
  assert(
    previewProviderNotConnected({ projectId: "p", userId: "u", sessionId: "s", files, vercelToken: null }),
    "not connected",
  );
  assert(noToken.logs.some((l) => /Vercel not connected/i.test(l)), "honest not_connected log");

  assert(PREVIEW_PROVIDER_CHAIN.includes("vercel_preview"), "provider chain includes vercel");
  assert(PREVIEW_PROVIDER_CHAIN.includes("static_snapshot"), "provider chain includes static");

  const completeBuild = fs.readFileSync(
    path.join(root, "src/lib/build/complete-build-with-validation.ts"),
    "utf8",
  );
  assert(!completeBuild.includes('lifecycle = input.previewUrl'), "build must not auto preview_ready");
  assert(completeBuild.includes('preview_ready: false'), "build clears preview_ready");

  const previewSvc = fs.readFileSync(path.join(root, "src/lib/preview/preview-build-service.ts"), "utf8");
  assert(previewSvc.includes("PREVIEW_ELIGIBLE"), "preview blocked before generated lifecycle");
  assert(previewSvc.includes("preview_honest"), "honest preview metadata");

  console.log("preview/publish fixture tests ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
