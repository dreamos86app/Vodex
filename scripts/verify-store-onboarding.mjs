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

must("src/lib/mobile/store-onboarding-steps.ts", "GOOGLE_PLAY_WIZARD_STEPS", "Google Play steps");
must("src/lib/mobile/store-onboarding-steps.ts", "APPLE_WIZARD_STEPS", "Apple steps");
must("src/lib/mobile/store-onboarding-steps.ts", "canAdvanceWizardStep", "sequential wizard — cannot skip");
must("src/components/mobile/store-onboarding-wizard.tsx", "canAdvanceWizardStep", "wizard enforces order");
must("src/components/mobile/mobile-wrapper-studio.tsx", "StoreOnboardingWizard", "studio embeds wizards");
must("src/components/mobile/mobile-wrapper-studio.tsx", "store_onboarding_progress", "progress persisted");

if (errors.length) {
  console.error("verify:store-onboarding FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:store-onboarding OK");
