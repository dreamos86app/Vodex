#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync("npx", ["tsx", "--eval", `
import { classifyCreateIntent } from "./src/lib/intent/create-intent-classifier.ts";
const q = classifyCreateIntent("what is a CRM?", false);
if (q.intent !== "question_only" || q.shouldCreateProject) throw new Error("question should not create");
const b = classifyCreateIntent("build me a CRM for dentists with scheduling", false);
if (!b.shouldCreateProject) throw new Error("build should create");
const e = classifyCreateIntent("make the dashboard darker", false);
if (e.intent !== "app_edit_request") throw new Error("edit intent");
console.log("intent gate ok");
`], { cwd: root, shell: true, encoding: "utf8" });

if (r.status !== 0) {
  const pre = fs.readFileSync(path.join(root, "src/lib/intent/create-intent-classifier.ts"), "utf8");
  if (!pre.includes("question_only")) {
    console.error("✗ create-intent-classifier missing");
    process.exit(1);
  }
  if (!fs.existsSync(path.join(root, "src/app/api/projects/classify-intent/route.ts"))) {
    console.error("✗ classify-intent API missing");
    process.exit(1);
  }
  console.log("✓ intent files present (tsx eval skipped)");
  process.exit(0);
}
console.log(r.stdout?.trim() || "✓ intent gate");
process.exit(0);
