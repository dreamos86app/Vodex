/** Line-count metadata for workflow file events — only when real content is available. */

export type FileLineMeta = {
  added_lines: number;
  removed_lines: number;
  old_line_count: number;
  new_line_count: number;
};

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

/**
 * Multiset line diff — counts lines added/removed between versions.
 * Returns undefined when there is no new content or content is unchanged.
 */
export function computeFileLineMeta(
  oldContent: string | undefined,
  newContent: string | undefined,
): FileLineMeta | undefined {
  if (newContent == null || newContent === "") return undefined;

  const newLines = splitLines(newContent);
  const new_line_count = newLines.length;

  if (oldContent == null || oldContent === "") {
    if (new_line_count === 0) return undefined;
    return {
      added_lines: new_line_count,
      removed_lines: 0,
      old_line_count: 0,
      new_line_count,
    };
  }

  if (oldContent === newContent) return undefined;

  const oldLines = splitLines(oldContent);
  const old_line_count = oldLines.length;
  const oldBag = new Map<string, number>();
  for (const line of oldLines) {
    oldBag.set(line, (oldBag.get(line) ?? 0) + 1);
  }
  let unchanged = 0;
  for (const line of newLines) {
    const n = oldBag.get(line) ?? 0;
    if (n > 0) {
      oldBag.set(line, n - 1);
      unchanged += 1;
    }
  }
  const added_lines = Math.max(0, newLines.length - unchanged);
  const removed_lines = Math.max(0, oldLines.length - unchanged);

  if (added_lines === 0 && removed_lines === 0 && new_line_count === old_line_count) {
    return undefined;
  }

  return {
    added_lines,
    removed_lines,
    old_line_count,
    new_line_count,
  };
}
