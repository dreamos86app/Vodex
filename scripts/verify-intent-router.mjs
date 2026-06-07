#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const code = `
import { routeBuilderTask } from "./src/lib/intent/task-router.ts";

const cases = [
  ["What is a CRM?", { route: "question_only" }],
  ["Why is preview blocked?", { projectId: "p1", route: "question_only" }],
  ["Fix the preview blocked issue", { projectId: "p1", route: "project_repair" }],
  ["Create a CRM app", { route: "project_build" }],
  ["Change the homepage title", { projectId: "p1", route: "project_edit" }],
];

for (const [prompt, expect] of cases) {
  const r = routeBuilderTask(prompt, {
    projectId: expect.projectId ?? null,
    hasFiles: Boolean(expect.projectId),
  });
  if (r.route !== expect.route) {
    throw new Error(\`"\${prompt}" => \${r.route}, expected \${expect.route}\`);
  }
}
console.log("verify:intent-router passed", cases.length);
`;

const r = spawnSync("npx", ["tsx", "--eval", code], { cwd: root, shell: true, encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
console.log(r.stdout?.trim());
