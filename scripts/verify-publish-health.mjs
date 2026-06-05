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

must("src/lib/publish/publish-health-retry.ts", "PUBLISH_HEALTH_RETRY_DELAYS_MS", "retry schedule");
must("src/lib/publish/publish-health-retry.ts", "5_000", "5s retry");
must("src/lib/publish/publish-health-retry.ts", "120_000", "120s retry");
must("src/lib/publish/publish-health-retry.ts", "verifyPublishedUrlHealthWithRetry", "retry orchestrator");
must("src/lib/publish/publish-service.ts", "verifyPublishedUrlHealthWithRetry", "publish uses retry health");
must("src/lib/publish/publish-health-retry.ts", "dnsOk", "DNS probe");
must("src/lib/publish/publish-health-retry.ts", "sslOk", "SSL probe");

if (errors.length) {
  console.error("verify:publish-health FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:publish-health OK");
