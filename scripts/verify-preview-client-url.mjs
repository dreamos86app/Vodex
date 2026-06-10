#!/usr/bin/env node
/**
 * Client preview iframe URL source tracing gates.
 * Usage:
 *   npm run verify:preview-client-url-source
 *   npm run verify:preview-cache-clears-stale-url
 *   npm run verify:preview-iframe-src-normalized
 *   npm run verify:no-relative-api-projects-iframe
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const resolver = read("src/lib/preview/preview-iframe-url-resolver.ts");
const panel = read("src/components/create/workspace/preview-panel.tsx");
const immersive = read("src/components/create/workspace/immersive-workspace.tsx");
const cache = read("src/lib/preview/clear-preview-client-cache.ts");

const checks = {
  "preview-client-url-source": () => {
    assert(resolver.includes("tracePreviewUrlCandidates"), "missing tracePreviewUrlCandidates");
    assert(resolver.includes("resolvePreviewIframeUrl"), "missing resolvePreviewIframeUrl");
    assert(resolver.includes("previewRuntime.previewUrl"), "missing runtime candidate");
    assert(resolver.includes("project.preview_url"), "missing project candidate");
    assert(resolver.includes("generated_fallback"), "missing generated fallback");
    assert(immersive.includes("resolvePreviewIframeUrl"), "immersive must resolve preview URL");
    assert(immersive.includes("previewRuntime?.previewUrl"), "immersive must use runtime previewUrl");
    assert(panel.includes("urlResolution"), "PreviewPanel must accept urlResolution");
    assert(panel.includes("data-preview-source"), "PreviewPanel diagnostics missing");
  },
  "preview-cache-clears-stale-url": () => {
    assert(cache.includes("clearPreviewClientCache"), "missing clearPreviewClientCache");
    assert(immersive.includes("clearPreviewClientCache"), "immersive must clear preview cache");
    assert(panel.includes("Clear cache"), "PreviewPanel clear cache UI");
    assert(immersive.includes("preview/import-status"), "clear cache must refetch runtime status");
  },
  "preview-iframe-src-normalized": () => {
    assert(resolver.includes("toPreviewIframeSrc"), "resolver must build iframe src");
    assert(resolver.includes("rebuilt_canonical"), "resolver must rebuild canonical URL");
    assert(resolver.includes("isRelativeApiProjectsPath"), "relative api/projects guard");
    assert(panel.includes("previewIframeDomKey"), "iframe dom key helper");
    assert(panel.includes("iframeDomKey"), "PreviewPanel must use dom key");
  },
  "no-relative-api-projects-iframe": () => {
    assert(resolver.includes("relative_api_projects"), "reject relative api/projects");
    assert(panel.includes('refused relative api/projects iframe src'), "panel rejects relative src");
    assert(panel.includes("refused traced relative iframe src"), "panel rejects traced relative src");
    assert(!panel.includes('href={url!}') || panel.includes("resolvedPreviewUrl"), "open tab must not use raw url only");
  },
};

const only = process.argv[2];
const names = only ? [only] : Object.keys(checks);
let failed = 0;
for (const name of names) {
  const fn = checks[name];
  if (!fn) {
    console.error(`Unknown check: ${name}`);
    failed++;
    continue;
  }
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}
process.exit(failed > 0 ? 1 : 0);
