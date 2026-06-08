/**
 * P1.3.15 — Honest extraction streaming when model returns one JSON blob.
 * Emits file_started / file_completed as each path is parsed (not model token streaming).
 */
import { parseBuildFilesFromModel } from "@/lib/build/parse-build-files";
import { computeFileLineMeta } from "@/lib/build/file-line-counts";
import type { BuildFile } from "@/lib/build/generated-file-utils";

export type ExtractionFileEvent =
  | {
      type: "file_started";
      path: string;
      operation: "create" | "edit";
    }
  | {
      type: "file_delta";
      path: string;
      lines_added: number;
      lines_removed: number;
      current_line_count: number;
    }
  | {
      type: "file_completed";
      path: string;
      operation: "create" | "edit" | "rewrite";
      lines_added: number;
      lines_removed: number;
      current_line_count: number;
    };

export type ExtractionStreamOptions = {
  interFileDelayMs?: number;
  /** Live delta tick interval while a file is being written (ms). */
  liveDeltaTickMs?: number;
  existingByPath?: Map<string, string>;
};

function lineCount(content: string): number {
  return content.split(/\r?\n/).length;
}

/**
 * Parse model output and emit per-file events with optional delay between files.
 */
export async function streamExtractBuildFiles(
  text: string,
  handlers: {
    onEvent?: (ev: ExtractionFileEvent) => void | Promise<void>;
    onFile?: (file: BuildFile) => void | Promise<void>;
  },
  opts?: ExtractionStreamOptions,
): Promise<{ files: BuildFile[]; streamMode: "extraction_stream" }> {
  const parsed = parseBuildFilesFromModel(text);
  const existing = opts?.existingByPath ?? new Map<string, string>();
  const delay = opts?.interFileDelayMs ?? 90;
  const liveTick = opts?.liveDeltaTickMs ?? 1000;
  const files: BuildFile[] = [];

  for (let i = 0; i < parsed.files.length; i++) {
    const f = parsed.files[i]!;
    const prev = existing.get(f.path);
    const operation: "create" | "edit" = prev ? "edit" : "create";
    await handlers.onEvent?.({ type: "file_started", path: f.path, operation });

    const lineMeta = computeFileLineMeta(prev, f.content);
    const added = lineMeta?.added_lines ?? lineCount(f.content);
    const removed = lineMeta?.removed_lines ?? 0;
    const current = lineCount(f.content);

    const progressSteps = Math.max(1, Math.min(8, Math.ceil(added / 12) || 1));
    for (let step = 1; step < progressSteps; step++) {
      await new Promise((r) => setTimeout(r, liveTick));
      await handlers.onEvent?.({
        type: "file_delta",
        path: f.path,
        lines_added: Math.max(1, Math.round((added * step) / progressSteps)),
        lines_removed: Math.round((removed * step) / progressSteps),
        current_line_count: Math.max(1, Math.round((current * step) / progressSteps)),
      });
    }

    await handlers.onEvent?.({
      type: "file_delta",
      path: f.path,
      lines_added: added,
      lines_removed: removed,
      current_line_count: current,
    });

    await handlers.onEvent?.({
      type: "file_completed",
      path: f.path,
      operation,
      lines_added: added,
      lines_removed: removed,
      current_line_count: current,
    });

    files.push(f);
    await handlers.onFile?.(f);
    existing.set(f.path, f.content);

    if (i < parsed.files.length - 1 && delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { files, streamMode: "extraction_stream" };
}
