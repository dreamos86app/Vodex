#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "src/lib/data.ts"), "utf8");
const errors = [];
const ok = [];

if (!src.includes("May 23, 2026")) errors.push("missing May 23, 2026 entry");
else ok.push("May 23, 2026 entry");

if (/3\s*[×x]\s*profit|charge_tokens|\bRPC\b|ledger hardening|profit protection/i.test(src)) {
  errors.push("changelog contains internal business language");
} else {
  ok.push("no internal economics in changelog");
}

if (!src.includes("Production reliability, credits, ZIP import")) errors.push("missing release title");
else ok.push("release title");

console.log("\n=== verify:changelog ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
