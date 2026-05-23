#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

[
  "src/lib/ai/dreamos-knowledge-pack.ts",
  "src/lib/ai/chat-mode-policy.ts",
  "src/lib/ai/chat-capability-policy.ts",
  "src/lib/ai/safe-product-context.ts",
  "src/lib/ai/chat-system-prompts.ts",
].forEach(mustExist);

mustExist("src/lib/creation/system-prompt.ts");
const sys = fs.readFileSync(path.join(root, "src/lib/creation/system-prompt.ts"), "utf8");
if (!sys.includes("buildDiscussSystemPrompt")) errors.push("system-prompt must use discuss knowledge pack");
else ok.push("system-prompt wired to knowledge pack");

const discuss = fs.readFileSync(path.join(root, "src/lib/ai/chat-system-prompts.ts"), "utf8");
for (const needle of [
  "NEVER claim you built, edited, or published",
  "Refuse revenue margins",
  "ZIP import",
  "what model are you using",
]) {
  if (!discuss.includes(needle)) errors.push(`chat-system-prompts missing: ${needle}`);
  else ok.push(`discuss prompt: ${needle}`);
}

// Runtime policy checks via ts compiled path — use dynamic import of compiled not available; inline mirror tests
const policyPath = path.join(root, "src/lib/ai/chat-mode-policy.ts");
const capPath = path.join(root, "src/lib/ai/chat-capability-policy.ts");
const policySrc = fs.readFileSync(policyPath, "utf8");
const capSrc = fs.readFileSync(capPath, "utf8");

if (!policySrc.includes("canBuildApps: false")) errors.push("discuss must not build apps");
else ok.push("discuss canBuildApps false");

if (!capSrc.includes("profit") || !capSrc.includes("provider")) {
  errors.push("missing profit/provider confidential guard");
} else {
  ok.push("profit/multiplier confidential guard");
}

if (!capSrc.includes("isConfidentialQuestion")) errors.push("missing confidential guard");
else ok.push("confidential question guard");

const knowledge = fs.readFileSync(path.join(root, "src/lib/ai/dreamos-knowledge-pack.ts"), "utf8");
if (!knowledge.includes("zipImport")) errors.push("knowledge pack missing zipImport");
else ok.push("knowledge pack zip import");

if (!knowledge.includes("billingUserSafe")) errors.push("knowledge pack missing billingUserSafe");
else ok.push("knowledge pack billing user safe");

const safeR = spawnSync("npx", ["tsx", path.join(root, "scripts/test-chat-safe.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
});
if (safeR.status === 0) ok.push("chat safe runtime tests");
else {
  errors.push("chat safe runtime tests failed");
  if (safeR.stdout) console.log(safeR.stdout);
  if (safeR.stderr) console.error(safeR.stderr);
}

console.log("\n=== verify:chat ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
