#!/usr/bin/env node
/**
 * Loads benchmark prompts and writes a stub report structure.
 * Full live runs require E2E_RUN_LIVE=1 and authenticated API (not run in CI by default).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const promptDir = path.join(root, "benchmarks/prompts");
const outPath = path.join(root, "benchmarks/reports/latest-run.json");

const setArg = process.argv.find((a) => a.startsWith("--set="))?.split("=")[1]
  ?? (process.argv.includes("--set") ? process.argv[process.argv.indexOf("--set") + 1] : null);

const files = setArg
  ? [`${setArg}.json`]
  : fs.readdirSync(promptDir).filter((f) => f.endsWith(".json"));
const all = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(promptDir, f), "utf8"));
  for (const p of j.prompts ?? []) {
    all.push({ id: p.id, prompt: p.text, category: j.category });
  }
}

const report = {
  runAt: new Date().toISOString(),
  mode: process.env.E2E_RUN_LIVE === "1" ? "live" : "structure_only",
  promptCount: all.length,
  prompts: all,
  note: "Run score-generation-benchmark.mjs after live generation results exist.",
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`✓ Benchmark prompt set: ${all.length} prompts → ${outPath}`);
