#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("src/lib/email/marketing-email-templates.ts", "MARKETING_EMAIL_TEMPLATES", "email templates registry");
must("src/lib/email/send-resend-email.ts", "sendResendEmail", "Resend delivery");
must("src/lib/email/workspace-invite-email.ts", "invite", "invite email");
must("src/lib/email/credit-usage-email-automation.ts", "credit", "credits email automation");
must("scripts/verify-p36-production.mjs", "email-templates-premium", "premium email verify hook");

const templates = fs.readFileSync(
  path.join(root, "src/lib/email/marketing-email-templates.ts"),
  "utf8",
);
for (const id of ["welcome", "upgrade_offer", "credits_low", "new_feature"]) {
  if (!templates.includes(id)) errors.push(`template id ${id}`);
}
must("src/lib/email/send-destructive-action-email.ts", "sendDestructiveActionEmail", "transactional emails");
if (!/@media\s*\(\s*prefers-color-scheme:\s*dark/i.test(templates) && !/#0f172a/i.test(templates)) {
  errors.push("responsive email layout");
}

if (errors.length) {
  console.error("verify:email-certification FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:email-certification OK");
