import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];
  const proxy = await read("src/proxy.ts");
  const gate = await read("src/components/onboarding/onboarding-app-gate.tsx");
  const layout = await read("src/app/(app)/layout.tsx");
  const provider = await read("src/components/providers/app-provider.tsx");

  if (!proxy.includes("onboarding_completed")) errors.push("proxy must redirect incomplete onboarding");
  if (!gate.includes("OnboardingAppGate")) errors.push("missing OnboardingAppGate");
  if (!layout.includes("OnboardingAppGate")) errors.push("(app) layout must wrap OnboardingAppGate");
  if (provider.includes('pathname === "/"')) errors.push("app-provider must not exempt / from onboarding redirect");

  if (errors.length) {
    console.error("verify:onboarding-gate FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:onboarding-gate OK");
}

main();
