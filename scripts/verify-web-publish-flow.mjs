#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/lib/publish/publish-service.ts", "publish_verify_failed", "DB verify before success");
must("src/lib/publish/publish-service.ts", "verifyPublishedUrlHealth", "URL health check");
must("src/lib/publish/publish-service.ts", "publish_health_failed", "health failure code");
must("src/lib/publish/publish-url-health.ts", "verifyPublishedUrlHealth", "health module");
must("src/components/publish/publish-success-panel.tsx", "publish-success-panel", "success panel");
must("src/components/create/workspace/publish-modal.tsx", "PublishSuccessPanel", "modal uses success panel");

if (errors.length) {
  console.error("verify:web-publish-flow FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:web-publish-flow OK");
