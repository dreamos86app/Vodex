import type { FileTreeNode } from "@/components/editor/file-tree";

export type TreeEntry =
  | { kind: "folder"; name: string; path: string; children: TreeEntry[] }
  | { kind: "file"; node: FileTreeNode };

export function buildFileTree(files: FileTreeNode[]): TreeEntry[] {
  const root: TreeEntry[] = [];

  for (const node of files) {
    const parts = node.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let level = root;
    let prefix = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      prefix = prefix ? `${prefix}/${part}` : part;
      if (isFile) {
        level.push({ kind: "file", node: { ...node, path: node.path } });
        break;
      }
      let folder = level.find(
        (e): e is Extract<TreeEntry, { kind: "folder" }> =>
          e.kind === "folder" && e.name === part,
      );
      if (!folder) {
        folder = { kind: "folder", name: part, path: prefix, children: [] };
        level.push(folder);
      }
      level = folder.children;
    }
  }

  const sortEntries = (entries: TreeEntry[]): TreeEntry[] =>
    entries
      .map((e) =>
        e.kind === "folder" ? { ...e, children: sortEntries(e.children) } : e,
      )
      .sort((a, b) => {
        if (a.kind === "folder" && b.kind === "file") return -1;
        if (a.kind === "file" && b.kind === "folder") return 1;
        const an = a.kind === "folder" ? a.name : a.node.path.split("/").pop() ?? "";
        const bn = b.kind === "folder" ? b.name : b.node.path.split("/").pop() ?? "";
        return an.localeCompare(bn);
      });

  return sortEntries(root);
}

/** Guess primary route file for highlight (Next.js app router). */
export function guessRouteFilePath(files: FileTreeNode[]): string | null {
  const paths = files.map((f) => f.path);
  const preferred = ["app/page.tsx", "src/app/page.tsx", "pages/index.tsx"];
  for (const p of preferred) {
    if (paths.includes(p)) return p;
  }
  return paths.find((p) => /\/page\.(tsx|jsx|js)$/.test(p)) ?? null;
}
