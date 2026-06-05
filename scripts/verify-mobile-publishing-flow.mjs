#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/lib/mobile/eligibility-report.ts", "buildEligibilityReport", "eligibility report");
must("src/lib/mobile/eligibility-report.ts", "EligibilityTier", "critical tier type");
must("src/app/api/projects/[id]/mobile/readiness/route.ts", "runAppReadinessEngine", "readiness engine");
must("src/app/api/projects/[id]/mobile/readiness/route.ts", "revenuecat_opt_out", "RC opt-out");
must("src/app/api/projects/[id]/mobile/readiness/route.ts", "Content-Disposition", "JSON download");
must("src/lib/mobile/capacitor-generator.ts", "launchShowDuration", "splash in capacitor");
must("src/lib/mobile/capacitor-generator.ts", "play_sha256_fingerprints", "multi sha256");
must("src/app/api/projects/[id]/mobile/build/route.ts", "artifactVerified", "artifact verification flag");
must("src/app/api/projects/[id]/mobile/build/route.ts", "artifact_missing", "no fake success without artifact");

if (errors.length) {
  console.error("verify:mobile-publishing-flow FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:mobile-publishing-flow OK");
