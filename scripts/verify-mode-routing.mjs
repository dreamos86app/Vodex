import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];
  const immersive = await read("src/components/create/workspace/immersive-workspace.tsx");
  const optimistic = await read("src/components/create/workspace/optimistic-assistant-row.tsx");
  const dots = await read("src/components/ui/animated-dots.tsx");

  if (!immersive.includes("lockedTaskMode")) errors.push("immersive-workspace must lock mode at submit");
  if (!optimistic.includes("DISCUSS_PHASES")) errors.push("optimistic row must have discuss-only phases");
  if (optimistic.includes("preview readiness")) {
    errors.push("optimistic phases must not use preview readiness copy");
  }
  if (!dots.includes("MAX_DOTS = 3")) errors.push("animated dots must cap at 3");

  if (errors.length) {
    console.error("verify:mode-routing FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:mode-routing OK");
}

main();
