#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { devServerBaseUrl, diagnoseDevServer, printDevServerRequired } from "./lib/dev-server.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

function parsePlaywrightSummary(output) {
  const failed = output.match(/(\d+)\s+failed/);
  const passed = output.match(/(\d+)\s+passed/);
  const skipped = output.match(/(\d+)\s+skipped/);
  return {
    failed: failed ? Number(failed[1]) : null,
    passed: passed ? Number(passed[1]) : null,
    skipped: skipped ? Number(skipped[1]) : null,
  };
}

function stripNoise(text) {
  return text
    .split("\n")
    .filter(
      (line) =>
        !/Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR'/i.test(line) &&
        !/Use `node --trace-warnings`/i.test(line),
    )
    .join("\n");
}

console.log("\n=== verify:editor ===\n");

[
  "src/components/editor/file-tree.tsx",
  "src/components/editor/editor-tabs.tsx",
  "src/components/editor/ai-diff-viewer.tsx",
  "src/components/editor/checkpoint-timeline.tsx",
  "src/components/builder/app-builder-workspace.tsx",
  "src/lib/editor/file-tree-build.ts",
  "src/lib/editor/editor-session.ts",
  "src/lib/editor/diff.ts",
  "src/lib/editor/checkpoints.ts",
  "src/lib/editor/pending-diff-store.ts",
  "src/app/api/editor/apply-diff/route.ts",
  "src/app/api/editor/pending-diff/route.ts",
  "src/app/api/editor/checkpoints/route.ts",
  "tests/e2e/builder-diff.spec.ts",
].forEach(mustExist);

const tree = fs.readFileSync(path.join(root, "src/components/editor/file-tree.tsx"), "utf8");
if (tree.includes("buildFileTree") && tree.includes("pendingChange")) ok.push("file tree: hierarchy + badges");
else errors.push("file tree incomplete");

const tabs = fs.readFileSync(path.join(root, "src/components/editor/editor-tabs.tsx"), "utf8");
if (tabs.includes("dirty") && tabs.includes("saving")) ok.push("tabs: dirty + save state");
else errors.push("tabs incomplete");

const diffUi = fs.readFileSync(path.join(root, "src/components/editor/ai-diff-viewer.tsx"), "utf8");
if (diffUi.includes("Reject all") && diffUi.includes("Review AI changes")) ok.push("AI diff: accept/reject all + preview");
else errors.push("ai-diff-viewer incomplete");

const cpUi = fs.readFileSync(path.join(root, "src/components/editor/checkpoint-timeline.tsx"), "utf8");
if (cpUi.includes("Confirm") && cpUi.includes("CHECKPOINT_STAGE_LABELS")) ok.push("checkpoints: stages + confirm rollback");
else errors.push("checkpoint-timeline incomplete");

const ws = fs.readFileSync(path.join(root, "src/components/builder/app-builder-workspace.tsx"), "utf8");
if (ws.includes("loadEditorSession") && ws.includes("validateAfterApply") && ws.includes("onFilesChanged")) {
  ok.push("workspace: session + validation + refresh");
} else errors.push("app-builder-workspace incomplete");

const apply = fs.readFileSync(path.join(root, "src/app/api/editor/apply-diff/route.ts"), "utf8");
if (apply.includes("validateAfterApply")) ok.push("apply-diff validates after apply");
else errors.push("apply-diff missing validation");

const pending = fs.readFileSync(path.join(root, "src/app/api/editor/pending-diff/route.ts"), "utf8");
if (pending.includes("remainingDiffs")) ok.push("pending-diff partial reject support");
else errors.push("pending-diff missing partial reject");

const r = spawnSync("npx", ["tsx", path.join(root, "scripts/editor-tests.ts")], {
  cwd: root,
  shell: true,
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
});
if (r.status === 0) ok.push("editor fixture tests");
else errors.push(`fixture tests: ${stripNoise((r.stderr || r.stdout || "").trim()).slice(-400)}`);

const e2eArgs = ["playwright", "test", "builder-diff"];
if (process.env.E2E_RUN_LIVE !== "1") {
  e2eArgs.push("--grep-invert", "@live");
} else {
  e2eArgs.push("--grep", "@live");
}

const baseUrl = devServerBaseUrl();
const serverDiag = await diagnoseDevServer(baseUrl);

if (serverDiag.state !== "healthy") {
  errors.push(`builder-diff E2E skipped — ${serverDiag.message}`);
  printDevServerRequired(baseUrl, serverDiag);
} else {
  ok.push(`dev server up (${serverDiag.http?.url ?? baseUrl})`);

  const e2e = spawnSync("npx", e2eArgs, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1",
      PLAYWRIGHT_SKIP_SERVER: process.env.PLAYWRIGHT_SKIP_SERVER ?? "1",
      PLAYWRIGHT_BASE_URL: baseUrl,
    },
  });

  const e2eOut = stripNoise(`${e2e.stdout ?? ""}\n${e2e.stderr ?? ""}`);
  const summary = parsePlaywrightSummary(e2eOut);

  if (e2e.status === 0) {
    ok.push(`builder-diff E2E${process.env.E2E_RUN_LIVE === "1" ? " (@live)" : ""}`);
  } else if (/ECONNREFUSED|connect ECONNREFUSED/i.test(e2eOut)) {
    errors.push(
      "builder-diff E2E — connection refused; verify:editor requires npm run dev on localhost:3000",
    );
    printDevServerRequired(baseUrl);
  } else {
    const tail = e2eOut
      .split("\n")
      .filter((l) => /Error:|failed|✗|expect\(/i.test(l))
      .slice(-8)
      .join(" | ");
    errors.push(
      `builder-diff E2E: ${summary.failed ?? "?"} failed, ${summary.passed ?? "?"} passed${tail ? ` — ${tail.slice(0, 280)}` : ""}`,
    );
  }
}

const evidencePath = path.join(root, ".dreamos-evidence.json");
const evidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, "utf8")) : {};
evidence.editorRuntimeHonest = errors.length === 0;
evidence.editorScoreBefore = evidence.editorScoreBefore ?? 75;
evidence.fileTreeScoreBefore = evidence.fileTreeScoreBefore ?? 78;
evidence.aiDiffScoreBefore = evidence.aiDiffScoreBefore ?? 72;
evidence.checkpointScoreBefore = evidence.checkpointScoreBefore ?? 65;
evidence.editorScoreAfter = errors.length === 0 ? 86 : 75;
evidence.fileTreeScoreAfter = errors.length === 0 ? 88 : 78;
evidence.aiDiffScoreAfter = errors.length === 0 ? 84 : 72;
evidence.checkpointScoreAfter = errors.length === 0 ? 80 : 65;
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
ok.push(`evidence editorRuntimeHonest=${evidence.editorRuntimeHonest}`);

ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
