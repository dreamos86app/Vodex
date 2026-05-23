export type FileDiff = {
  path: string;
  before: string;
  after: string;
  addedLines: number;
  removedLines: number;
};

export function computeLineDiff(before: string, after: string): { added: number; removed: number } {
  const b = before.split("\n");
  const a = after.split("\n");
  let removed = 0;
  let added = 0;
  const max = Math.max(b.length, a.length);
  for (let i = 0; i < max; i++) {
    const bl = b[i];
    const al = a[i];
    if (bl === undefined) added++;
    else if (al === undefined) removed++;
    else if (bl !== al) {
      removed++;
      added++;
    }
  }
  return { added, removed };
}

export function diffPreviewLines(before: string, after: string, max = 6): string[] {
  const b = before.split("\n");
  const a = after.split("\n");
  const lines: string[] = [];
  const maxLen = Math.max(b.length, a.length);
  for (let i = 0; i < maxLen && lines.length < max; i++) {
    const bl = b[i];
    const al = a[i];
    if (bl === al) continue;
    if (bl !== undefined && (al === undefined || bl !== al)) lines.push(`- ${bl.slice(0, 120)}`);
    if (al !== undefined && (bl === undefined || bl !== al) && lines.length < max) {
      lines.push(`+ ${al.slice(0, 120)}`);
    }
  }
  return lines;
}

export function buildFileDiffs(
  patches: Array<{ path: string; content: string }>,
  existing: Record<string, string>,
): FileDiff[] {
  return patches.map((p) => {
    const before = existing[p.path] ?? "";
    const { added, removed } = computeLineDiff(before, p.content);
    return {
      path: p.path,
      before,
      after: p.content,
      addedLines: added,
      removedLines: removed,
    };
  });
}

export function diffChangedPaths(diffs: FileDiff[]): string[] {
  return diffs.map((d) => d.path);
}
