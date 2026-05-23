import { fingerprintFile, rejectBannedRefs } from "@/lib/ai/file-fingerprint";

const SECRET_PATTERN = /(service_role|secret|password|api[_-]?key)\s*[:=]/i;

export type CompressibleFile = { path: string; content: string };

export type CompressedContext = {
  summary: string;
  files: Array<{ path: string; content?: string; hash: string; included: boolean }>;
  tokensSavedEstimate: number;
};

export function compressProjectContext(
  files: CompressibleFile[],
  changedPaths: Set<string>,
  maxFullFiles = 8,
): CompressedContext {
  const safeFiles = files.filter((f) => !SECRET_PATTERN.test(f.content) && !rejectBannedRefs(f.content));

  let fullCount = 0;
  let savedChars = 0;
  const out: CompressedContext["files"] = [];

  for (const f of safeFiles) {
    const hash = fingerprintFile(f.path, f.content);
    const mustInclude = changedPaths.has(f.path) || fullCount < maxFullFiles;
    if (mustInclude) {
      fullCount += 1;
      out.push({ path: f.path, content: f.content, hash, included: true });
    } else {
      savedChars += f.content.length;
      out.push({ path: f.path, hash, included: false });
    }
  }

  return {
    summary: `Project pack: ${safeFiles.length} files, ${fullCount} full, ${safeFiles.length - fullCount} hash-only`,
    files: out,
    tokensSavedEstimate: Math.floor(savedChars / 4),
  };
}
