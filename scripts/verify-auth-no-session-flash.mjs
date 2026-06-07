#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const authState = fs.readFileSync(path.join(root, "src/lib/auth/auth-session-state.ts"), "utf8");
const provider = fs.readFileSync(path.join(root, "src/components/providers/app-provider.tsx"), "utf8");

const required = [
  "loading_initial_session",
  "refreshing_session",
  "unauthenticated_confirmed",
  "shouldRedirectToLogin",
  "redirect_to_login_blocked_due_refresh",
  "get_user_transient_failure",
];

for (const token of required) {
  if (!authState.includes(token)) {
    console.error(`✗ auth-session-state missing ${token}`);
    process.exit(1);
  }
}

if (!provider.includes("shouldRedirectToLogin")) {
  console.error("✗ app-provider must gate login redirect");
  process.exit(1);
}

console.log("✓ verify:auth-no-session-flash passed");
