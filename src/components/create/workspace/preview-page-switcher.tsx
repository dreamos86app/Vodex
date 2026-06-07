"use client";

import * as React from "react";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewRouteEntry } from "@/lib/preview/detect-preview-routes";
import { FloatingMenu } from "@/components/ui/floating-menu";

export function PreviewPageSwitcher({
  routes,
  currentPath,
  onSelect,
  disabled,
}: {
  routes: PreviewRouteEntry[];
  currentPath: string;
  onSelect: (path: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const current = routes.find((r) => r.path === currentPath) ?? routes[0];
  const filtered = routes.filter(
    (r) =>
      r.path.toLowerCase().includes(filter.toLowerCase()) ||
      r.label.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="relative flex min-w-0 flex-1 justify-center">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex max-w-[min(100%,280px)] items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition",
          "text-foreground hover:bg-surface disabled:opacity-40",
        )}
        data-testid="preview-page-switcher"
      >
        <FileText className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{current?.label ?? "Page"}</span>
        <span className="truncate text-muted-foreground">{current?.path ?? "/"}</span>
        <ChevronDown className={cn("size-3 shrink-0 transition", open && "rotate-180")} />
      </button>

      <FloatingMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        returnFocusRef={buttonRef}
        width={Math.min(320, typeof window !== "undefined" ? window.innerWidth - 24 : 320)}
        layer="dropdown"
      >
        {routes.length > 6 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search routes…"
            className="mx-2 mb-1 w-[calc(100%-16px)] rounded border border-border bg-surface px-2 py-1 text-[11px] outline-none"
          />
        )}
        <ul className="max-h-56 overflow-y-auto py-1">
          {filtered.map((r) => (
            <li key={r.path}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[11px] transition hover:bg-accent/8",
                  r.path === currentPath && "bg-accent/10 font-semibold text-accent",
                )}
                onClick={() => {
                  onSelect(r.path);
                  setOpen(false);
                }}
              >
                <span>{r.label}</span>
                <span className="text-muted-foreground">{r.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </FloatingMenu>
    </div>
  );
}
