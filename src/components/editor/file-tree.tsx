"use client";

import * as React from "react";
import {
  FileCode,
  Folder,
  FolderOpen,
  Search,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Pencil,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildFileTree, guessRouteFilePath, type TreeEntry } from "@/lib/editor/file-tree-build";

export type FileTreeNode = {
  path: string;
  dirty?: boolean;
  generated?: boolean;
  edited?: boolean;
  hasError?: boolean;
  pendingChange?: boolean;
};

function FileBadges({ node }: { node: FileTreeNode }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {node.pendingChange ? (
        <GitCompare className="size-3 text-accent" aria-label="Pending AI change" />
      ) : null}
      {node.generated && !node.edited ? (
        <Sparkles className="size-3 text-accent/80" aria-label="Generated" />
      ) : null}
      {node.edited ? <Pencil className="size-3 text-muted-foreground" aria-label="Edited" /> : null}
      {node.dirty ? <span className="size-1.5 rounded-full bg-amber-400" aria-label="Unsaved" /> : null}
      {node.hasError ? <AlertCircle className="size-3 text-destructive" aria-label="Error" /> : null}
    </span>
  );
}

function TreeRow({
  entry,
  depth,
  selectedPath,
  routePath,
  expanded,
  onToggle,
  onSelect,
}: {
  entry: TreeEntry;
  depth: number;
  selectedPath?: string | null;
  routePath?: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  if (entry.kind === "folder") {
    const open = expanded.has(entry.path);
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggle(entry.path)}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left hover:bg-muted/60"
          style={{ paddingLeft: `${depth * 10 + 8}px` }}
        >
          <ChevronRight className={cn("size-3 shrink-0 transition", open && "rotate-90")} />
          {open ? (
            <FolderOpen className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-[11px] font-medium text-foreground">{entry.name}</span>
        </button>
        {open && (
          <ul>
            {entry.children.map((child) => (
              <TreeRow
                key={child.kind === "folder" ? child.path : child.node.path}
                entry={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                routePath={routePath}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const f = entry.node;
  const name = f.path.split("/").pop() ?? f.path;
  const isRoute = routePath === f.path;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(f.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left",
          selectedPath === f.path ? "bg-accent/15 text-foreground ring-1 ring-accent/25" : "hover:bg-muted/60",
          isRoute && selectedPath !== f.path && "ring-1 ring-accent/10",
        )}
        style={{ paddingLeft: `${depth * 10 + 20}px` }}
      >
        <FileCode className="size-3 shrink-0" />
        <span className="min-w-0 truncate font-mono text-[11px]">{name}</span>
        <FileBadges node={f} />
      </button>
    </li>
  );
}

export function EditorFileTree({
  files,
  selectedPath,
  onSelect,
  className,
}: {
  files: FileTreeNode[];
  selectedPath?: string | null;
  onSelect: (path: string) => void;
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  const routePath = React.useMemo(() => guessRouteFilePath(files), [files]);
  const tree = React.useMemo(() => buildFileTree(files), [files]);

  React.useEffect(() => {
    if (tree.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      const walk = (entries: TreeEntry[]) => {
        for (const e of entries) {
          if (e.kind === "folder") {
            next.add(e.path);
            walk(e.children);
          }
        }
      };
      walk(tree);
      return next;
    });
  }, [tree]);

  const filtered = React.useMemo(() => {
    if (!q.trim()) return files;
    const lower = q.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(lower));
  }, [files, q]);

  const displayTree = q.trim()
    ? buildFileTree(filtered)
    : tree;

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className={cn("flex h-full flex-col", className)} data-testid="builder-file-tree">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search files…"
          className="w-full min-w-0 bg-transparent text-[12px] outline-none"
        />
      </div>
      <ul className="flex-1 overflow-y-auto overflow-x-hidden p-1 text-[12px]">
        {displayTree.length === 0 ? (
          <li className="px-2 py-4 text-center text-[11px] text-muted-foreground">No files</li>
        ) : (
          displayTree.map((entry) => (
            <TreeRow
              key={entry.kind === "folder" ? entry.path : entry.node.path}
              entry={entry}
              depth={0}
              selectedPath={selectedPath}
              routePath={routePath}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
            />
          ))
        )}
      </ul>
    </div>
  );
}
