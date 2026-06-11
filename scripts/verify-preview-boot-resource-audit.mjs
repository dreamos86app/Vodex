#!/usr/bin/env node
/** P1.3.37 — boot resource audit injected into served preview HTML. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const audit = fs.readFileSync(path.join(root, "src/lib/preview/inject-preview-boot-audit.ts"), "utf8");
const rewrite = fs.readFileSync(path.join(root, "src/lib/preview/rewrite-preview-artifact-html.ts"), "utf8");
const panel = fs.readFileSync(path.join(root, "src/components/create/workspace/preview-panel.tsx"), "utf8");
const types = fs.readFileSync(path.join(root, "src/lib/preview/preview-boot-audit-types.ts"), "utf8");

assert(audit.includes("vodex-preview-boot-audit"), "audit postMessage type");
assert(audit.includes('post("ready"'), "audit signals ready on DOMContentLoaded");
assert(audit.includes("getEntriesByType"), "resource performance audit");
assert(audit.includes("serviceWorker"), "SW audit");
assert(audit.includes("pushState"), "navigation audit");
assert(rewrite.includes("injectPreviewBootAudit"), "rewrite wires audit");
assert(panel.includes("isPreviewBootAuditMessage"), "panel handles audit messages");
assert(types.includes("summarizeBootAudit"), "audit summarizer exists");
assert(types.includes("isIgnorablePreviewAssetLoadFailure"), "ignorable asset filter exists");
assert(audit.includes("ignorableAssetFailure"), "iframe audit filters route-root false positives");

console.log("✓ verify:preview-boot-resource-audit");
