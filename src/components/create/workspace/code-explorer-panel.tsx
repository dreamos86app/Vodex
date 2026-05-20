"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Download,
  FileCode2,
  Folder,
  FolderOpen,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export type CodeExplorerFile = { path: string; content: string };

const META_PATH_RE = /^(build-metadata|\.dreamos|metadata\.json)/i;

function defaultSelectedPath(files: CodeExplorerFile[]): string | null {
  if (files.length === 0) return null;
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const real = sorted.filter((f) => !META_PATH_RE.test(f.path));
  const pool = real.length > 0 ? real : sorted;
  const preview = pool.find((f) => /preview\/index\.html$/i.test(f.path));
  if (preview) return preview.path;
  const page = pool.find((f) => /src\/app\/page\.(tsx|jsx)$/i.test(f.path));
  if (page) return page.path;
  const html = pool.find((f) => /\.html$/i.test(f.path));
  if (html) return html.path;
  return pool[0]!.path;
}

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: CodeExplorerFile;
};

function buildTree(files: CodeExplorerFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let level = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      const isDir = i < parts.length - 1;
      let node = level.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: acc, isDir, children: [], file: isDir ? undefined : file };
        level.push(node);
      }
      if (!isDir) node.file = file;
      level = node.children;
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root);
  return root;
}

function langFromPath(path: string): string {
  if (/\.tsx?$/i.test(path)) return "typescript";
  if (/\.jsx?$/i.test(path)) return "javascript";
  if (/\.css$/i.test(path)) return "css";
  if (/\.html?$/i.test(path)) return "html";
  if (/\.json$/i.test(path)) return "json";
  if (/\.sql$/i.test(path)) return "sql";
  if (/\.md$/i.test(path)) return "markdown";
  return "plaintext";
}

function highlightLine(line: string, lang: string): React.ReactNode {
  if (lang === "plaintext") return line;
  const parts: React.ReactNode[] = [];
  let rest = line;
  const push = (text: string, cls: string, key: number) => {
    if (!text) return;
    parts.push(
      <span key={key} className={cls}>
        {text}
      </span>,
    );
  };
  const patterns: Array<{ re: RegExp; cls: string }> = [
    { re: /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/, cls: "text-emerald-600/80 dark:text-emerald-400/70" },
    { re: /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/, cls: "text-amber-700 dark:text-amber-300/90" },
    { re: /\b(import|export|from|const|let|var|function|return|if|else|async|await|class|interface|type)\b/, cls: "text-violet-600 dark:text-violet-400" },
    { re: /\b(true|false|null|undefined)\b/, cls: "text-sky-600 dark:text-sky-400" },
  ];
  let key = 0;
  while (rest.length > 0) {
    let earliest: { index: number; len: number; cls: string; text: string } | null = null;
    for (const { re, cls } of patterns) {
      re.lastIndex = 0;
      const m = re.exec(rest);
      if (m && m.index !== undefined && (earliest === null || m.index < earliest.index)) {
        earliest = { index: m.index, len: m[0].length, cls, text: m[0] };
      }
    }
    if (!earliest) {
      push(rest, "", key++);
      break;
    }
    if (earliest.index > 0) push(rest.slice(0, earliest.index), "", key++);
    push(earliest.text, earliest.cls, key++);
    rest = rest.slice(earliest.index + earliest.len);
  }
  return parts.length ? parts : line;
}

function TreeRow({
  node,
  depth,
  activePath,
  expanded,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const isOpen = expanded.has(node.path);
  const isActive = activePath === node.path;

  if (node.isDir) {
    return (
      <>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className={cn(
            "flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[11px] transition hover:bg-surface",
            isActive && "bg-accent/10",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {isOpen ? (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="size-3.5 shrink-0 text-amber-500/80" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-amber-500/80" />
          )}
          <span className="truncate font-medium text-foreground">{node.name}</span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[11px] transition",
        isActive ? "bg-accent/15 font-medium text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground",
      )}
      style={{ paddingLeft: 20 + depth * 12 }}
    >
      <FileCode2 className="size-3 shrink-0 opacity-70" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function CodeExplorerPanel({
  files,
  loading,
  changedPaths,
  projectId,
  fallbackText,
}: {
  files: CodeExplorerFile[];
  loading?: boolean;
  changedPaths?: Set<string>;
  projectId?: string | null;
  fallbackText?: string;
}) {
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(["src", "preview"]));
  const [query, setQuery] = React.useState("");

  const sourceFiles = React.useMemo(
    () => files.filter((f) => !META_PATH_RE.test(f.path)),
    [files],
  );
  const metaFiles = React.useMemo(
    () => files.filter((f) => META_PATH_RE.test(f.path)),
    [files],
  );
  const displayFiles = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...sourceFiles, ...metaFiles];
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, sourceFiles, metaFiles, query]);

  const tree = React.useMemo(() => buildTree(displayFiles), [displayFiles]);

  React.useEffect(() => {
    const next = defaultSelectedPath(sourceFiles.length > 0 ? sourceFiles : files);
    setActivePath((prev) => {
      if (prev && files.some((f) => f.path === prev)) return prev;
      return next;
    });
  }, [files, sourceFiles]);

  const active = files.find((f) => f.path === activePath);
  const lang = active ? langFromPath(active.path) : "plaintext";
  const lines = active?.content.split("\n") ?? [];

  const toggleDir = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  async function copyFile() {
    if (!active?.content) return;
    try {
      await navigator.clipboard.writeText(active.content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  function downloadProject() {
    if (files.length === 0) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { projectId, exportedAt: new Date().toISOString(), files: files.map((f) => ({ path: f.path, content: f.content })) },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dreamos-${projectId ?? "project"}-files.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Download started");
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-[12px]">Loading project files…</span>
      </div>
    );
  }

  if (files.length === 0 && !fallbackText?.trim()) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileCode2 className="size-8 text-muted-foreground/40" strokeWidth={1.25} />
        <p className="text-[13px] font-medium text-foreground">No generated files yet</p>
        <p className="max-w-sm text-[12px] leading-relaxed text-muted-foreground">
          Run a build — files are saved to your project and appear here with folder tree and syntax highlighting.
        </p>
      </div>
    );
  }

  if (files.length === 0 && fallbackText?.trim()) {
    return (
      <pre className="h-full overflow-auto p-4 text-[11px] leading-relaxed text-foreground [scrollbar-gutter:stable]">
        {fallbackText}
      </pre>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-md border border-border/60 bg-background py-1 pl-7 pr-2 text-[11px] outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>
        <button
          type="button"
          onClick={copyFile}
          disabled={!active}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-40"
          title="Copy file"
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={downloadProject}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
          title="Download project"
        >
          <Download className="size-3.5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-[min(42%,240px)] shrink-0 overflow-y-auto border-r border-border bg-surface/40 py-1">
          <p className="sticky top-0 z-10 bg-surface/95 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sourceFiles.length} files
            {changedPaths && changedPaths.size > 0 ? (
              <span className="ml-1 text-accent">· {changedPaths.size} changed</span>
            ) : null}
          </p>
          {tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              expanded={expanded}
              onToggle={toggleDir}
              onSelect={setActivePath}
            />
          ))}
          {metaFiles.length > 0 && (
            <div className="mt-2 border-t border-border/50 px-2 pt-2">
              <p className="mb-1 text-[9px] font-semibold uppercase text-muted-foreground">Build metadata</p>
              {metaFiles.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setActivePath(f.path)}
                  className={cn(
                    "block w-full truncate rounded-md px-2 py-1 text-left text-[10px]",
                    activePath === f.path ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-surface",
                  )}
                >
                  {f.path}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border/50 px-3 py-1 text-[10px] text-muted-foreground">
            {activePath}
          </div>
          <div className="min-h-0 flex-1 overflow-auto font-mono text-[11px] leading-[1.45] [scrollbar-gutter:stable]">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-surface/30">
                    <td className="w-10 select-none pr-2 text-right align-top text-[10px] tabular-nums text-muted-foreground/60">
                      {i + 1}
                    </td>
                    <td className="whitespace-pre pr-4 text-foreground">{highlightLine(line, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
