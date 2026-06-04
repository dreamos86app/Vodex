#!/usr/bin/env node
import { rewritePreviewArtifactHtml } from "../src/lib/preview/rewrite-preview-artifact-html.ts";

const projectId = "proj-1";
const buildId = "job-abc";
const sample = `<!DOCTYPE html><html><head>
<link rel="stylesheet" crossorigin href="/assets/index-dead.css">
</head><body>
<script type="module" crossorigin src="/assets/index-beef.js"></script>
</body></html>`;

const out = rewritePreviewArtifactHtml(sample, projectId, buildId);
if (!out.includes(`/api/projects/${encodeURIComponent(projectId)}/preview-assets/assets/index-beef.js`)) {
  throw new Error("script src not rewritten");
}
if (!out.includes("build=" + encodeURIComponent(buildId))) {
  throw new Error("build query missing");
}
if (out.includes('href="/assets/')) {
  throw new Error("unrewritten absolute asset path remains");
}

console.log("verify:preview-artifact-rewrite OK");
