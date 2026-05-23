#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (text.includes(needle)) ok.push(label);
  else errors.push(`missing ${label} in ${file}`);
}

mustInclude("src/app/api/chat/route.ts", "resolveStageModel", "chat uses model-cost-runtime");
mustInclude("src/app/api/chat/route.ts", "completeBuildWithValidation", "chat validates on finish");
mustInclude("src/lib/build/finalize-build.ts", "completeBuildWithValidation", "finalize uses validator");
mustInclude("src/lib/chat/staged-build-response.ts", "completeBuildWithValidation", "staged build validates");
mustInclude("src/app/api/build/blueprint/route.ts", "resolveStageModel", "blueprint uses optimizer");
mustInclude("src/app/api/build/polish/route.ts", "resolveStageModel", "polish uses optimizer");
mustInclude("src/app/api/projects/[id]/status/route.ts", "canTransition", "lifecycle PATCH");
mustInclude("src/components/create/premium-create-funnel.tsx", "CreateTemplatePicker", "premium funnel templates");
mustInclude("src/app/(workspace)/create/page.tsx", "PremiumCreateFunnel", "/create single funnel");
mustInclude("src/app/p/[slug]/page.tsx", "PublicAppRenderer", "public app renderer");
mustInclude("src/lib/publish/publish-service.ts", "capturePublishedSnapshot", "publish snapshot");
mustInclude("src/components/builder/app-builder-workspace.tsx", "loadPendingDiff", "builder loads pending diff");
mustInclude("src/components/builder/app-builder-workspace.tsx", "onFilesChanged", "builder refreshes files after apply");
mustInclude("src/lib/chat/post-edit-pending-diff.ts", "savePendingDiff", "chat edit creates pending diff");
mustInclude("src/app/api/editor/apply-diff/route.ts", "validateAfterApply", "apply-diff validates after apply");

console.log("\n=== verify:wiring ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
