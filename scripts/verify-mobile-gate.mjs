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

must("src/lib/mobile/readiness-gate.ts", "assertMobileReadinessGate", "readiness-gate module");
must("src/lib/mobile/readiness-gate.ts", "sanitizeMobileConfigPatch", "sanitize meta spoof");
must("src/app/api/projects/[id]/mobile/build/route.ts", "assertMobileReadinessGate", "build route enforces gate");
must("src/app/api/projects/[id]/wrap/route.ts", "assertMobileReadinessGate", "wrap route enforces gate");
must("src/app/api/projects/[id]/mobile/config/route.ts", "sanitizeMobileConfigPatch", "config strips gate meta");
must("src/app/api/projects/[id]/mobile/build/route.ts", "gate.state.code", "build returns gate error code");
must("src/lib/mobile/readiness-gate.ts", "readiness_gate_passed_at", "gate meta key");

if (errors.length) {
  console.error("verify:mobile-gate FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:mobile-gate OK");
