#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function must(rel, needle, label) {
  const s = fs.readFileSync(path.join(root, rel), "utf8");
  if (!s.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(label);
}

must("src/lib/credits/canonical-credit-display.ts", "buildCreditBreakdown", "canonical credit breakdown");
must("src/lib/credits/credit-summary.ts", "buildCreditBreakdown", "credits API uses canonical breakdown");
must("src/lib/admin/list-users.ts", "bonus_credits", "admin users expose bonus credits");
must("src/lib/billing/plan-credit-economics.ts", "free: 20", "free plan is 20");
must("src/components/admin/admin-users-panel.tsx", "available", "admin drawer shows available not X/Y only");
must("src/app/api/admin/model-smoke-report/route.ts", "requireDreamosOwner", "smoke report owner-only");
must("supabase/migrations/20260622120000_admin_otp_diagnostic_logs.sql", "admin_pending_confirmations", "confirmations table migration");

console.log("\n=== verify:admin-accuracy ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
