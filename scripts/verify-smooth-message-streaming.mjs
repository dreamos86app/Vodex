#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
if (!fs.existsSync(path.join(root, "src/components/create/workspace/streaming-narration-line.tsx"))) {
  errors.push("missing streaming-narration-line.tsx");
}
const stream = read("src/components/create/workspace/agent-workflow-stream.tsx");
if (!stream.includes("StreamingNarrationLine")) errors.push("workflow uses StreamingNarrationLine");
const narration = read("src/components/create/workspace/streaming-narration-line.tsx");
if (!narration.includes("data-streaming")) errors.push("typewriter streaming marker");
if (!stream.includes("collapseHeartbeatAssistantMessages")) errors.push("heartbeat narration collapse");
if (!read("src/lib/workflow/user-facing-workflow-events.ts").includes("meta.heartbeat === true")) {
  errors.push("hide heartbeat duplicates");
}

if (errors.length) {
  console.error("verify:smooth-message-streaming FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:smooth-message-streaming OK");
