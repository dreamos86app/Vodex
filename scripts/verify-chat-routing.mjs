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

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

mustExist("src/app/api/conversations/route.ts");
mustExist("src/app/api/conversations/[id]/messages/route.ts");
mustInclude("src/components/chat/chat-view.tsx", "switchConversation", "conversation switch");
mustInclude("src/components/chat/chat-view.tsx", "/api/conversations", "server conversation list");
mustInclude("src/components/chat/chat-view.tsx", "/api/conversations/${conversationId}/messages", "server messages");

console.log("\n=== verify:chat-routing ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
