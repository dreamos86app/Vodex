#!/usr/bin/env node
/** P1.3.36 — imported ZIP paths must not use AI generation continuing copy. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const resolver = fs.readFileSync(path.join(root, "src/lib/preview/resolve-preview-state.ts"), "utf8");
const panel = fs.readFileSync(path.join(root, "src/components/create/workspace/preview-panel.tsx"), "utf8");
const truth = fs.readFileSync(path.join(root, "src/lib/build/app-build-truth.ts"), "utf8");

assert(resolver.includes("importedArtifactReady"), "resolver handles imported artifact ready");
assert(resolver.includes("showGenerationContinuingCopy: false"), "imported ready suppresses generation copy");
assert(resolver.includes("ai_generation_incomplete"), "AI-only generation incomplete state exists");
assert(panel.includes("resolvePreviewState"), "preview panel uses canonical resolver");
assert(panel.includes("showGenerationContinuingCopy"), "panel uses canonical generation flag");
assert(!panel.includes("Continue generation from chat when the build pauses"), "hardcoded generation copy removed from panel overlay");
assert(truth.includes("importedPreviewArtifactReady"), "app build truth allows imported artifact preview");

console.log("✓ verify:preview-no-generation-copy-for-imports");
