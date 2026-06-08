/**
 * Preview build auto-repair — targeted fixes without reducing app scope.
 */
import type { BuildFile } from "@/lib/build/generated-file-utils";
import type { PreviewFailureClassification } from "@/lib/preview/preview-failure-classifier";
import { buildTodoStubRepairPrompt } from "@/lib/build/todo-stub-detector";

export type PreviewAutoRepairPromptInput = {
  classification: PreviewFailureClassification;
  files: BuildFile[];
  userPrompt?: string;
  attempt: number;
};

export function shouldAttemptPreviewAutoRepair(
  classification: PreviewFailureClassification,
  attempt: number,
  maxAttempts = 2,
): boolean {
  return classification.auto_repair_eligible && attempt < maxAttempts;
}

export function buildPreviewAutoRepairPrompt(input: PreviewAutoRepairPromptInput): string {
  const { classification: c, files, attempt } = input;

  if (c.failure_kind === "preview_source_validation_failed" && c.failing_file) {
    const matchFile = files.find((f) => f.path === c.failing_file);
    if (matchFile) {
      return buildTodoStubRepairPrompt(
        {
          file_path: c.failing_file,
          detector: "preview_source_validation_failed",
          snippet: matchFile.content.slice(0, 200),
          severity: "blocking",
          blocking: true,
        },
        input.userPrompt,
      );
    }
  }

  const tree = files.map((f) => f.path).slice(0, 80).join("\n");
  const logTail = c.build_logs_tail.slice(-40).join("\n");

  return [
    "PREVIEW BUILD REPAIR — change only what is required to fix the compile error.",
    `Attempt: preview_repair_attempt_${attempt + 1}`,
    `Failure kind: ${c.failure_kind}`,
    `Stage: ${c.failure_stage}`,
    `Error: ${c.failure_message}`,
    c.failing_file ? `Failing file: ${c.failing_file}${c.failing_line ? `:${c.failing_line}` : ""}` : "",
    c.missing_imports.length ? `Missing imports: ${c.missing_imports.join(", ")}` : "",
    c.typescript_error ? `TypeScript: ${c.typescript_error}` : "",
    c.vite_error ? `Vite: ${c.vite_error}` : "",
    c.npm_error ? `npm: ${c.npm_error}` : "",
    "",
    "RULES:",
    "- Do NOT reduce app scope, file count, or routes.",
    "- Do NOT replace the app with a generic scaffold.",
    "- Fix only the files needed for preview to compile.",
    "- Return JSON file payload with patched files only.",
    "",
    `Current file tree (${files.length} files):`,
    tree,
    "",
    "Build log tail:",
    logTail || "(no logs captured)",
    "",
    input.userPrompt ? `Original app prompt: ${input.userPrompt.slice(0, 500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function previewRepairAttemptLabel(attempt: number): string {
  return `preview_repair_attempt_${attempt + 1}`;
}
