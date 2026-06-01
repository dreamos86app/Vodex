import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];
  const logo = await read("src/lib/projects/app-logo-generation.ts");
  const icon = await read("src/components/projects/project-icon.tsx");
  const identity = await read("src/lib/projects/app-identity-service.ts");

  if (!logo.includes("full-bleed circular-safe")) errors.push("logo prompt must require circular-safe icon");
  if (!logo.includes('fit: "cover"')) errors.push("logo derivatives must use cover crop");
  if (!icon.includes("object-cover")) errors.push("ProjectIcon must use object-cover");
  if (!identity.includes("app_icon_ai_generation")) errors.push("identity service must charge app_icon_ai_generation");

  if (errors.length) {
    console.error("verify:project-icon-generation FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:project-icon-generation OK");
}

main();
