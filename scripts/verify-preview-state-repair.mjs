#!/usr/bin/env node
/** P1.3.36 — preview state repair API + client handler. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const route = path.join(root, "src/app/api/projects/[id]/preview/state-repair/route.ts");
const immersive = fs.readFileSync(path.join(root, "src/components/create/workspace/immersive-workspace.tsx"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/components/preview/preview-universal-error-panel.tsx"), "utf8");

assert(fs.existsSync(route), "state-repair route exists");
const routeSrc = fs.readFileSync(route, "utf8");
assert(routeSrc.includes("applyPreviewBuildToProject"), "repair applies preview build to project");
assert(routeSrc.includes("buildVirtualPreviewRuntimeUrl"), "repair normalizes preview-runtime URL");
assert(immersive.includes("handleRepairPreviewState"), "immersive wires repair handler");
assert(immersive.includes("/preview/state-repair"), "immersive calls state-repair API");
assert(ui.includes("Repair preview state"), "UI exposes repair preview state");

console.log("✓ verify:preview-state-repair");
