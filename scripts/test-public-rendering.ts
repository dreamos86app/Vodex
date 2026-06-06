#!/usr/bin/env node
/**
 * Public renderer fixture tests — avoids server-only imports.
 */
import { pickPreviewEntry } from "../src/lib/preview/preview-sandbox";
import { rewritePublishedArtifactHtml } from "../src/lib/publish/rewrite-published-artifact-html";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const FILES = [
  {
    path: "app/page.tsx",
    content: `export default function Page() {
  return (
    <main>
      <h1>Recipe Planner</h1>
      <p>Search recipes, save favorites, and plan weekly meals.</p>
    </main>
  );
}`,
  },
  { path: "package.json", content: '{"name":"recipe-planner","dependencies":{"react":"19"}}' },
];

const entry = pickPreviewEntry(FILES);
assert(Boolean(entry), "preview entry must exist for generated app files");
assert(
  entry?.kind === "react" && /page\.tsx$/i.test(entry.path),
  "Next app entry should resolve to page.tsx",
);

const artifactHtml = `<!DOCTYPE html><html><head><title></title></head><body><div id="root">Recipe Planner SPA — meal search and favorites</div><script src="/assets/index.js"></script></body></html>`;
const rewritten = rewritePublishedArtifactHtml(artifactHtml, "recipe-planner", "/", "Recipe Planner");
assert(rewritten.includes("/api/public/recipe-planner/assets/"), "artifact HTML must rewrite asset URLs");
assert(/<title>Recipe Planner<\/title>/i.test(rewritten), "empty title must be filled from app name");
assert(/Recipe Planner SPA/i.test(rewritten), "published artifact must retain app content");
assert(!/coming soon/i.test(rewritten), "must not be stub placeholder");

console.log("✓ public rendering fixture tests passed");
