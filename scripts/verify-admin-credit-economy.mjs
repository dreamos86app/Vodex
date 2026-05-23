#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustExist("src/lib/credits/credit-events.ts");
mustExist("src/components/admin/admin-credit-economy-panel.tsx");
mustExist("src/app/api/admin/credit-economy/route.ts");
mustInclude("src/lib/credits/credit-events.ts", "Math.max(0", "zero credits safe");
mustInclude("src/lib/credits/charge-ai-operation.ts", "writeCreditEvent", "uses safe credit event writer");

console.log("\n=== verify:admin-credit-economy ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
