import { normalizeBuildFilePath, type BuildFile } from "@/lib/build/generated-file-utils";

const IMPORT_RE =
  /(?:import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+|import\s+)['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export type MissingImport = {
  fromFile: string;
  specifier: string;
  resolvedPath: string | null;
};

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const parts = `${dir}/${specifier}`.split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") {
      stack.pop();
      continue;
    }
    stack.push(p);
  }
  const base = stack.join("/");
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ];
  return candidates[0] ?? null;
}

function resolveAliasImport(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;
  return normalizeBuildFilePath(specifier.slice(2));
}

function fileExistsAt(paths: Set<string>, base: string): boolean {
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ].map(normalizeBuildFilePath);
  return candidates.some((c) => paths.has(c));
}

export function findMissingAliasImports(
  files: BuildFile[],
  pathSet?: Set<string>,
): MissingImport[] {
  const paths = pathSet ?? new Set(files.map((f) => normalizeBuildFilePath(f.path)));
  const missing: MissingImport[] = [];

  for (const file of files) {
    const from = normalizeBuildFilePath(file.path);
    if (!/\.(tsx|jsx|ts|js)$/i.test(from)) continue;
    const content = file.content ?? "";
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content)) !== null) {
      const spec = m[1] ?? m[2];
      if (!spec?.startsWith("@/")) continue;
      const resolved = resolveAliasImport(spec);
      if (!resolved) continue;
      if (!fileExistsAt(paths, resolved)) {
        missing.push({ fromFile: from, specifier: spec, resolvedPath: resolved });
      }
    }
  }

  return missing;
}

export function findAllMissingImports(
  files: BuildFile[],
  pathSet?: Set<string>,
): MissingImport[] {
  const relative = findMissingRelativeImports(files, pathSet);
  const alias = findMissingAliasImports(files, pathSet);
  const seen = new Set<string>();
  const merged: MissingImport[] = [];
  for (const m of [...relative, ...alias]) {
    const key = `${m.fromFile}:${m.specifier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
  }
  return merged;
}

export function findMissingRelativeImports(
  files: BuildFile[],
  pathSet?: Set<string>,
): MissingImport[] {
  const paths = pathSet ?? new Set(files.map((f) => normalizeBuildFilePath(f.path)));
  const missing: MissingImport[] = [];

  for (const file of files) {
    const from = normalizeBuildFilePath(file.path);
    if (!/\.(tsx|jsx|ts|js)$/i.test(from)) continue;
    const content = file.content ?? "";
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content)) !== null) {
      const spec = m[1] ?? m[2];
      if (!spec?.startsWith(".")) continue;
      const resolved = resolveRelativeImport(from, spec);
      if (!resolved) continue;
      const found = fileExistsAt(paths, resolved);
      if (!found) {
        missing.push({ fromFile: from, specifier: spec, resolvedPath: resolved });
      }
    }
  }

  return missing;
}

export function countComponentFiles(files: BuildFile[]): number {
  return files.filter((f) => {
    const p = normalizeBuildFilePath(f.path);
    return /(^|\/)components\//i.test(p) && /\.(tsx|jsx)$/i.test(p);
  }).length;
}
