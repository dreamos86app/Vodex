import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];
  const naming = await read("src/lib/projects/clean-app-name.ts");
  const ctx = await read("src/lib/projects/project-context.ts");

  if (!naming.includes("TRAILING_FILLER")) errors.push("clean-app-name must strip trailing prepositions");
  if (!naming.includes("app\\s+with")) errors.push("clean-app-name must reject 'app with' fragments");
  if (!naming.includes("pickBrandableFromPrompt")) errors.push("clean-app-name must brandable-fallback from prompt");
  if (!ctx.includes("cleanAppName")) errors.push("refineAppName must delegate to cleanAppName");
  if (!naming.includes("slice(0, 24)")) errors.push("clean-app-name must enforce max display length");

  if (errors.length) {
    console.error("verify:app-naming FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:app-naming OK");
}

main();
