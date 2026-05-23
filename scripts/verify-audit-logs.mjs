#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

const AUDIT_CHECKS = [
  { rel: "src/lib/security/audit-events.ts", needle: "logSecurityAudit" },
  { rel: "src/app/api/projects/[id]/publish/route.ts", needle: 'action: "publish"' },
  { rel: "src/app/api/projects/[id]/unpublish/route.ts", needle: 'action: "unpublish"' },
  { rel: "src/app/api/deploy/vercel/start/route.ts", needle: 'action: "deploy"' },
  { rel: "src/lib/credits/charge-ai-operation.ts", needle: 'action: "credit_charge"' },
  { rel: "src/lib/billing/credit-reservations.ts", needle: 'action: "credit_refund"' },
  { rel: "src/app/api/projects/[id]/status/route.ts", needle: 'action: "lifecycle_override"' },
  { rel: "src/app/api/projects/[id]/repair/route.ts", needle: 'action: "repair"' },
  { rel: "src/app/api/admin/credits/route.ts", needle: "logAdminAudit" },
];

for (const { rel, needle } of AUDIT_CHECKS) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${rel}`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  if (text.includes(needle)) ok.push(`${rel} → ${needle}`);
  else errors.push(`${rel} missing ${needle}`);
}

console.log("\n=== verify:audit-logs ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
