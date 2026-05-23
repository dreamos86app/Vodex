#!/usr/bin/env node
/**
 * Verifies public marketing routes and nav targets exist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

function mustNotInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (src.includes(needle)) errors.push(`${rel} still contains removed ${label}`);
  else ok.push(`${rel}: no ${label}`);
}

[
  "src/components/marketing/public-landing.tsx",
  "src/components/marketing/public-conversion-cards.tsx",
  "src/components/marketing/how-it-works-demo.tsx",
  "src/components/layout/navigation-progress.tsx",
  "src/components/marketing/public-marketing-shell.tsx",
].forEach((f) => mustExist(f));

mustInclude("src/components/marketing/public-marketing-shell.tsx", 'href="/auth/signup"', "Get Started → signup");
mustInclude("src/components/marketing/public-marketing-shell.tsx", '"/auth/login"', "Log in");
mustInclude("src/components/marketing/public-landing.tsx", "PublicConversionCards", "conversion cards");
mustInclude("src/components/marketing/public-landing.tsx", "HowItWorksDemo", "how-it-works demo");
mustInclude("src/components/providers/app-provider.tsx", "NavigationProgress", "nav progress bar");
mustInclude("src/lib/navigation/route-perf.ts", "markNavigationStart", "route perf instrumentation");

mustNotInclude("src/components/marketing/public-landing.tsx", "PublicLandingTemplateGallery", "template gallery");
mustNotInclude("src/components/marketing/public-landing.tsx", "PublicLandingCostControl", "controlled AI cost");
mustNotInclude("src/components/marketing/public-landing.tsx", "PublicLandingDeploySection", "deploy section");
mustNotInclude("src/components/marketing/public-landing.tsx", "PublicLandingPricingFaq", "pricing at a glance");
mustNotInclude("src/components/marketing/public-landing.tsx", "PublicLandingWorkspacePreview", "workspace mock");
mustNotInclude("src/components/marketing/public-landing.tsx", "controlled AI cost", "cost headline");

const routes = [
  "src/app/(app)/page.tsx",
  "src/app/(workspace)/create/page.tsx",
  "src/app/(app)/pricing/page.tsx",
  "src/app/auth/login/page.tsx",
  "src/app/auth/signup/page.tsx",
];
routes.forEach((r) => mustExist(r));

console.log("\n=== verify:navigation ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
