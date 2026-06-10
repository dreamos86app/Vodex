#!/usr/bin/env node
/** P1.3.36 — preview debug drawer for owner diagnostics. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const drawer = fs.readFileSync(path.join(root, "src/components/preview/preview-debug-drawer.tsx"), "utf8");
const panel = fs.readFileSync(path.join(root, "src/components/create/workspace/preview-panel.tsx"), "utf8");
const immersive = fs.readFileSync(path.join(root, "src/components/create/workspace/immersive-workspace.tsx"), "utf8");

assert(drawer.includes("preview-debug-drawer"), "debug drawer test id");
assert(drawer.includes("canonicalState"), "drawer shows canonical state");
assert(drawer.includes("urlResolution"), "drawer includes URL trace");
assert(panel.includes("PreviewDebugDrawer"), "panel mounts debug drawer");
assert(immersive.includes("showPreviewDebug"), "immersive enables debug drawer");

console.log("✓ verify:preview-debug-drawer");
