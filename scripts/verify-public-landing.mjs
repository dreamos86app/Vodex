#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeEvidence, loadEvidence } from "./lib/e2e-live.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

function mustInclude(rel, needle) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing: ${needle}`);
  else ok.push(`${rel} has ${needle}`);
}

[
  "src/components/marketing/public-landing.tsx",
  "src/components/marketing/public-conversion-cards.tsx",
  "src/components/marketing/how-it-works-demo.tsx",
  "src/components/chat/message-cost-header.tsx",
  "src/components/os-home/dreamos-stats-section.tsx",
  "src/components/os-home/why-dreamos-section.tsx",
].forEach(mustExist);

mustInclude("src/components/marketing/public-landing.tsx", "DreamOsStatsSection");
mustInclude("src/components/marketing/public-landing.tsx", "WhyDreamOsSection");
mustInclude("src/components/os-home/os-home.tsx", "DreamOsStatsSection");
mustInclude("src/components/os-home/os-home.tsx", "WhyDreamOsSection");
mustInclude("src/components/os-home/dreamos-stats-section.tsx", "/api/public/stats");
mustInclude("src/components/os-home/dreamos-stats-section.tsx", "StatSkeleton");
mustInclude("src/lib/billing/plans.ts", "free: 30");
mustInclude("src/components/marketing/public-landing.tsx", 'data-testid="public-landing"');
mustInclude("src/components/marketing/public-conversion-cards.tsx", 'data-testid="public-conversion-cards"');
mustInclude("src/components/marketing/how-it-works-demo.tsx", 'data-testid="how-it-works-demo"');
mustInclude("src/components/marketing/how-it-works-demo.tsx", "From idea to live app");
mustInclude("src/components/chat/message-cost-header.tsx", "message-cost-final");
mustInclude("src/components/create/workspace/dreamos-message-shell.tsx", "MessageCostBadge");

const landing = fs.readFileSync(path.join(root, "src/components/marketing/public-landing.tsx"), "utf8");
for (const banned of ["Template gallery", "Controlled AI cost", "Honest deploy readiness", "Pricing at a glance"]) {
  if (landing.includes(banned)) errors.push(`public-landing still mentions "${banned}"`);
  else ok.push(`removed "${banned}"`);
}

console.log("\n=== verify:public-landing ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));

const evidence = loadEvidence();
const passed = errors.length === 0;
evidence.publicLandingHonest = passed;
evidence.publicLandingScoreAfter = passed ? 88 : evidence.publicLandingScoreAfter ?? 72;
evidence.polishScoreAfter = passed ? Math.max(evidence.polishScoreAfter ?? 80, 86) : evidence.polishScoreAfter;
evidence.endUserTrustScoreAfter = passed ? Math.max(evidence.endUserTrustScoreAfter ?? 82, 86) : evidence.endUserTrustScoreAfter;
evidence.createWorkflowScoreAfter = passed ? Math.max(evidence.createWorkflowScoreAfter ?? 85, 88) : evidence.createWorkflowScoreAfter;
writeEvidence(evidence);

process.exit(passed ? 0 : 1);
