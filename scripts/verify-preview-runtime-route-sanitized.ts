#!/usr/bin/env npx tsx
/** P1.3.39 — preview-runtime iframe route must not poison Next router bootstrap. */
import { sanitizePreviewBootstrapState } from "../src/lib/preview/preview-bootstrap-sanitizer";
import { scanTextForPathLeaks } from "../src/lib/preview/preview-path-leak-scanner";
import { rewritePreviewArtifactHtml } from "../src/lib/preview/rewrite-preview-artifact-html";

const projectId = "30066b29-15fa-41cf-9a6e-4111418be3e5";
const artifactId = "267e0278-d333-41e8-82ef-f8c309749df8";
const poison = `preview-runtime/${projectId}/${artifactId}`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const sanitized = sanitizePreviewBootstrapState(
  JSON.stringify({ page: poison, asPath: `/${poison}`, pathname: `/${poison}` }),
  projectId,
  "/",
);
assert(!sanitized.includes(poison), "sanitizer strips preview-runtime route from JSON");

const chunk = `"page":"${poison}"`;
const chunkOut = sanitizePreviewBootstrapState(chunk, projectId, "/");
assert(!chunkOut.includes("preview-runtime/"), "sanitizer strips minified page field");

const html = `<!DOCTYPE html><html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ page: poison, asPath: `/${poison}` })}</script></head><body></body></html>`;
const rewritten = rewritePreviewArtifactHtml(html, projectId, artifactId, "/");
assert(rewritten.includes("vodex-prehydration-location-rewrite"), "prehydration injected");
const leaks = scanTextForPathLeaks(rewritten, projectId).filter((l) => !l.safe);
assert(
  leaks.every((l) => l.pattern !== "preview_runtime_route"),
  `served html leaks: ${leaks.map((l) => l.pattern).join(", ")}`,
);

console.log("✓ verify:preview-runtime-route-sanitized");
