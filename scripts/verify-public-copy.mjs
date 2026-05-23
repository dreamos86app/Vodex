#!/usr/bin/env node
/**
 * Ensures user-facing copy never leaks internal billing/economics language.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

const PUBLIC_FILES = [
  "src/lib/data.ts",
  "src/components/changelog/changelog-view.tsx",
  "src/components/marketing/public-landing.tsx",
  "src/components/marketing/public-conversion-cards.tsx",
  "src/components/marketing/how-it-works-demo.tsx",
];

const FORBIDDEN = [
  { pattern: /3\s*[×x]\s*profit/i, label: "3× profit" },
  { pattern: /profit\s*protection/i, label: "profit protection" },
  { pattern: /provider\s*cost/i, label: "provider cost" },
  { pattern: /gross\s*margin/i, label: "gross margin" },
  { pattern: /\bRPC\b/i, label: "RPC" },
  { pattern: /service[_\s-]?role/i, label: "service role" },
  { pattern: /charge_tokens/i, label: "charge_tokens" },
  { pattern: /ledger\s*hardening/i, label: "ledger hardening" },
  { pattern: /internal\s*economics/i, label: "internal economics" },
  { pattern: /TARGET_REVENUE_MULTIPLIER/i, label: "revenue multiplier constant" },
];

for (const rel of PUBLIC_FILES) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${rel}`);
    continue;
  }
  const src = fs.readFileSync(full, "utf8");
  for (const { pattern, label } of FORBIDDEN) {
    if (pattern.test(src)) {
      errors.push(`${rel} contains forbidden public copy: ${label}`);
    }
  }
  ok.push(`${rel} scanned`);
}

const changelog = fs.readFileSync(path.join(root, "src/lib/data.ts"), "utf8");
if (changelog.includes("May 23, 2026") && changelog.includes("1,500 source files")) {
  ok.push("May 23 changelog mentions 1500 ZIP limit");
} else {
  errors.push("May 23 changelog missing 1500 ZIP mention");
}

console.log("\n=== verify:public-copy ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
