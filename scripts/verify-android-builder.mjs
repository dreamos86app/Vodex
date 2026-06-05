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

must("worker/android-builder/src/index.ts", "/v1/build", "builder HTTP webhook");
must("worker/android-builder/src/gradle-build.ts", "assembleRelease", "APK gradle task");
must("worker/android-builder/src/gradle-build.ts", "bundleRelease", "AAB gradle task");
must("worker/android-builder/src/gradle-build.ts", "ANDROID_HOME", "requires Android SDK");
must("worker/android-builder/src/build-job.ts", "postBuilderCallback", "callback to Vodex");
must("worker/android-builder/src/callback.ts", "X-Builder-Secret", "builder auth header");
must("src/app/api/mobile/builder/callback/route.ts", "verifyBuildArtifact", "honest artifact verify");
must("src/app/api/mobile/builder/callback/route.ts", "build_success", "no fake success");
must("src/lib/mobile/android-builder-dispatch.ts", "dispatchAndroidBuildJob", "dispatch from platform");
must("src/app/api/projects/[id]/mobile/build/route.ts", "dispatchAndroidBuildJob", "build route dispatches");
must("supabase/migrations/20260811120000_p40_mobile_infrastructure.sql", "claim_mobile_build_job", "claim RPC");

const pipeline = fs.readFileSync(path.join(root, "src/lib/mobile/mobile-build-pipeline.ts"), "utf8");
if (!pipeline.includes("buildSuccess: false")) {
  errors.push("pipeline defaults buildSuccess false");
}

if (errors.length) {
  console.error("verify:android-builder FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:android-builder OK");
