#!/usr/bin/env node
/**
 * Editor workspace fixture tests.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFileTree, guessRouteFilePath } from "../src/lib/editor/file-tree-build";
import { computeLineDiff, diffPreviewLines, buildFileDiffs } from "../src/lib/editor/diff";
import { createCheckpoint, CHECKPOINT_STAGE_LABELS } from "../src/lib/editor/checkpoints";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const tree = buildFileTree([
    { path: "app/page.tsx" },
    { path: "app/layout.tsx" },
    { path: "components/Button.tsx" },
  ]);
  assert(tree.some((e) => e.kind === "folder" && e.name === "app"), "folder hierarchy app/");
  assert(guessRouteFilePath([{ path: "app/page.tsx" }]) === "app/page.tsx", "route highlight path");

  const diff = computeLineDiff("a\nb", "a\nc\nd");
  assert(diff.added >= 1 && diff.removed >= 1, "line diff counts");

  const preview = diffPreviewLines("old line", "new line");
  assert(preview.some((l) => l.startsWith("+")), "diff preview hunks");

  const built = buildFileDiffs([{ path: "x.ts", content: "new" }], { "x.ts": "old" });
  assert(built[0]!.path === "x.ts", "buildFileDiffs");

  const cp = createCheckpoint({
    projectId: "p1",
    label: "Before edit",
    stage: "pre_edit",
    files: [{ path: "a.ts", content: "x" }],
    changedPaths: ["a.ts"],
  });
  assert(cp.stage === "pre_edit", "checkpoint pre_edit stage");
  assert(CHECKPOINT_STAGE_LABELS.pre_publish === "Before publish", "stage labels");

  const treeSrc = fs.readFileSync(path.join(root, "src/components/editor/file-tree.tsx"), "utf8");
  assert(treeSrc.includes("buildFileTree"), "file tree uses hierarchy");
  assert(treeSrc.includes("pendingChange"), "pending badge");

  const tabsSrc = fs.readFileSync(path.join(root, "src/components/editor/editor-tabs.tsx"), "utf8");
  assert(tabsSrc.includes("dirty"), "tab dirty state");
  assert(tabsSrc.includes("saving"), "tab save state");

  const diffSrc = fs.readFileSync(path.join(root, "src/components/editor/ai-diff-viewer.tsx"), "utf8");
  assert(diffSrc.includes("Reject all"), "reject all");
  assert(diffSrc.includes("Accept all"), "accept all");

  const cpSrc = fs.readFileSync(path.join(root, "src/components/editor/checkpoint-timeline.tsx"), "utf8");
  assert(cpSrc.includes("Confirm"), "rollback confirmation");

  const wsSrc = fs.readFileSync(path.join(root, "src/components/builder/app-builder-workspace.tsx"), "utf8");
  assert(wsSrc.includes("loadEditorSession"), "session restore");
  assert(wsSrc.includes("validateAfterApply"), "validation after apply");
  assert(wsSrc.includes("window.confirm"), "unsaved close warning");
  assert(wsSrc.includes("onFilesChanged"), "files refresh hook");

  const applySrc = fs.readFileSync(path.join(root, "src/app/api/editor/apply-diff/route.ts"), "utf8");
  assert(applySrc.includes("validateAfterApply"), "apply-diff validation gate");

  console.log("editor fixture tests ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
