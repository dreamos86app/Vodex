#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustInclude("src/components/chat/chat-view.tsx", "opt-user-", "optimistic user message");
mustInclude("src/components/chat/chat-view.tsx", "setInput(\"\")", "instant input clear");
mustInclude("src/components/chat/chat-view.tsx", "showStreamLoader", "single stream loader");

console.log("\n=== verify:chat-send-latency ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
