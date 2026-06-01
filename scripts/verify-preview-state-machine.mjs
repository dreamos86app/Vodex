import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];
  const poll = await read("src/lib/preview/preview-readiness-poll.ts");
  const immersive = await read("src/components/create/workspace/immersive-workspace.tsx");
  const guards = await read("src/lib/build/workflow-status-guards.ts");

  if (!poll.includes("PREVIEW_POLL_MAX_ATTEMPTS")) errors.push("preview poll must define max attempts");
  if (!immersive.includes("PREVIEW_POLL_MAX_ATTEMPTS")) errors.push("immersive must use preview poll limits");
  if (!guards.includes("Build saved — preview is still preparing")) {
    errors.push("workflow guards must not show couldn't start build when files exist");
  }

  if (errors.length) {
    console.error("verify:preview-state-machine FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:preview-state-machine OK");
}

main();
