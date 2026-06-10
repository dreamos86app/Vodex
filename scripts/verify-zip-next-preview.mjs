#!/usr/bin/env node
/**
 * Asserts preview HTML/JS sanitization removes poisoned preview-html router paths.
 */
import { stripPreviewPlatformPathsFromText } from "../src/lib/preview/strip-preview-platform-paths.ts";
import { injectPreviewVirtualHistory } from "../src/lib/preview/inject-preview-virtual-history.ts";

const projectId = "e688141b-13ff-4126-a301-787bd39a5d2c";
const poisoned = `
<script id="__NEXT_DATA__" type="application/json">{"page":"/api/projects/${projectId}/preview-html","asPath":"/api/projects/${projectId}/preview-html"}</script>
<script>self.__next_f.push([1,"/api/projects/${projectId}/preview-html"])</script>
`;

const stripped = stripPreviewPlatformPathsFromText(poisoned, projectId);
if (stripped.includes("preview-html")) {
  throw new Error("stripPreviewPlatformPathsFromText left preview-html in output");
}

const html = injectPreviewVirtualHistory(
  `<!DOCTYPE html><html><head></head><body>${stripped}</body></html>`,
  "/",
);
if (!html.includes("vodex-preview-virtual-history")) {
  throw new Error("virtual history shim not injected");
}
const headIdx = html.indexOf("<head");
const shimIdx = html.indexOf("vodex-preview-virtual-history");
if (shimIdx < headIdx) {
  throw new Error("shim should appear inside head");
}

console.log("verify:zip-next-preview OK");
