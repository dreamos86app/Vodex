#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const errors = [];

function must(src, needle, label) {
  if (!src.includes(needle)) errors.push(label);
}

const gate = read("src/components/session/vodex-session-intro-gate.tsx");
const intro = read("src/components/session/vodex-session-intro.tsx");
const decision = read("src/lib/session/session-intro-decision.ts");
const chrome = read("src/components/providers/app-chrome-providers.tsx");
const appLayout = read("src/app/(app)/layout.tsx");
const workspaceLayout = read("src/app/(workspace)/layout.tsx");

must(chrome, "VodexSessionIntroGate", "gate in AppChromeProviders");
must(appLayout, "AppChromeProviders", "app layout uses chrome");
must(workspaceLayout, "AppChromeProviders", "workspace layout uses chrome");
must(gate, "useLayoutEffect", "intro decision before paint");
must(gate, "decideSessionIntro", "deterministic decision");
must(gate, "appVisible", "app visibility gate");
must(gate, "deciding", "deciding phase hides app");
must(intro, "z-[9999]", "intro above all UI");
must(intro, "fixed inset-0", "full screen intro");
must(intro, "onVisible", "mark seen only when visible");
must(intro, "2400", "2.4s intro");
must(decision, "pending_cookie", "cookie rule");
must(decision, "fresh_tab_entry", "fresh tab rule");
must(decision, "onboarding_complete", "onboarding rule");
if (gate.includes("isLightweightPublicPath")) {
  errors.push("gate must not skip intro for lightweight public paths (was blocking /)");
}
must(read("src/lib/session/intro-debug.ts"), "[Vodex][intro] decision", "owner debug log");
must(read("src/lib/session/intro-debug.ts"), "__vodexShowIntro", "debug hook");
if (intro.includes("isPageReload")) {
  errors.push("intro must not block reload when session flag cleared");
}

if (errors.length) {
  console.error("verify:session-intro-visible FAILED");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log("OK verify:session-intro-visible");
