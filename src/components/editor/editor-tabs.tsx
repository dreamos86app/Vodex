"use client";

import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorTab = {
  path: string;
  dirty?: boolean;
  saving?: boolean;
};

export function EditorTabs({
  tabs,
  activePath,
  savingPath,
  onSelect,
  onClose,
}: {
  tabs: EditorTab[];
  activePath: string | null;
  savingPath?: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  if (tabs.length === 0) {
    return (
      <div
        className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground"
        data-testid="builder-editor-tabs"
      >
        Open a file from the tree to start editing.
      </div>
    );
  }

  return (
    <div
      className="flex overflow-x-auto border-b border-border bg-surface/50 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-testid="builder-editor-tabs"
    >
      {tabs.map((t) => {
        const isActive = activePath === t.path;
        const isSaving = savingPath === t.path || t.saving;
        return (
          <div
            key={t.path}
            className={cn(
              "flex shrink-0 items-center gap-1 border-r border-border px-2 py-1.5 text-[11px]",
              isActive ? "bg-background text-foreground" : "text-muted-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(t.path)}
              className="flex max-w-[140px] items-center gap-1 truncate"
              title={t.path}
            >
              {isSaving ? <Loader2 className="size-3 shrink-0 animate-spin" /> : null}
              <span className="truncate">{t.path.split("/").pop()}</span>
              {t.dirty ? <span className="text-amber-500">•</span> : null}
            </button>
            <button
              type="button"
              onClick={() => onClose(t.path)}
              className="rounded p-0.5 hover:bg-muted"
              aria-label={`Close ${t.path}`}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
