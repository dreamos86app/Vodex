#!/usr/bin/env node
/**
 * Build benchmark-50.json from canonical prompt sets (50 prompts total).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "benchmarks/prompts/benchmark-50.json");

const sets = [
  { file: "simple.json", appType: "landing", take: 10 },
  { file: "standard.json", appType: "dashboard", take: 10 },
  { file: "saas.json", appType: "saas", take: 10 },
  { file: "advanced.json", appType: "crm", take: 5 },
  { file: "mobile.json", appType: "booking", take: 5 },
  { file: "mobile-first.json", appType: "mobile_first", take: 5 },
  { file: "admin.json", appType: "ai_tool", take: 5 },
];

const prompts = [];
for (const s of sets) {
  const j = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/prompts", s.file), "utf8"));
  for (const p of (j.prompts ?? []).slice(0, s.take)) {
    prompts.push({ id: p.id, appType: s.appType, text: p.text, source: s.file });
  }
}

const doc = {
  category: "benchmark_50",
  description: "Full 50-prompt competitive benchmark",
  sources: sets.map((s) => `benchmarks/prompts/${s.file}`),
  promptCount: prompts.length,
  prompts,
};

fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`✓ Wrote ${prompts.length} prompts → ${out}`);
