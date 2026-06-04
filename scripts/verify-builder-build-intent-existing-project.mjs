#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mustInclude, finish } from "./lib/verify-static.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

mustInclude(
  root,
  "src/lib/ai/build-intent-classifier.ts",
  ["shouldStartBuildPipelineInProject", "checkout", "ticket"],
  errors,
);
mustInclude(root, "src/app/api/chat/route.ts", ["shouldStartBuildPipeline", "buildIntent"], errors);
mustInclude(root, "src/lib/intent/create-intent-classifier.ts", ["hasProjectId && (buildSignals"], errors);

mustInclude(
  root,
  "src/lib/ai/build-intent-classifier.ts",
  ["shouldStartBuildPipelineInProject", "build_app"],
  errors,
);

finish("verify:builder-build-intent-existing-project", errors);
