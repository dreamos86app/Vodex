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

must("supabase/migrations/20260629120000_mobile_wrapper_system.sql", "mobile_build_jobs", "mobile_build_jobs table");
must("src/lib/mobile/mobile-build-pipeline.ts", "verifyBuildArtifact", "artifact verification");
must("src/lib/mobile/mobile-build-pipeline.ts", "buildSuccess: false", "honest build_success default");
must("src/app/api/projects/[id]/mobile/build/route.ts", "mobile_build_jobs", "build queue persistence");
must("src/app/api/projects/[id]/mobile/build/route.ts", "artifact_verified", "artifact_verified in job meta");
must("src/app/api/projects/[id]/mobile/build/route.ts", "build_success", "build_success in job meta");
must("src/app/api/projects/[id]/mobile/build/route.ts", "verifyBuildArtifact", "route uses verifyBuildArtifact");
must("src/app/api/admin/mobile-builds/route.ts", "mobile_build_jobs", "admin build visibility");

if (errors.length) {
  console.error("verify:mobile-build-pipeline FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:mobile-build-pipeline OK");
