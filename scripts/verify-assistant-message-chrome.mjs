#!/usr/bin/env node
/** P1.3.15 — Assistant avatar + menu always visible during build */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const shell = read("src/components/create/workspace/dreamos-message-shell.tsx");
if (!shell.includes("VodexBrandIcon")) errors.push("Vodex avatar");
if (!shell.includes("MessageActionsMenu")) errors.push("actions menu");
if (shell.includes('status === "done" || status === "error"') && shell.includes("messageTextForCopy && (status")) {
  errors.push("menu still gated to done/error only");
}

const stream = read("src/components/create/workspace/agent-workflow-stream.tsx");
if (!stream.includes("DreamOSMessageShell")) errors.push("build stream uses message shell");

const workspace = read("src/components/create/workspace/immersive-workspace.tsx");
if (workspace.includes("if (workflowStreamOwnsFiles) return null")) {
  errors.push("chat history still hidden during build");
}

if (errors.length) {
  console.error("verify:assistant-message-chrome FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:assistant-message-chrome OK");
