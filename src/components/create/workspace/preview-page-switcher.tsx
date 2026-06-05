"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewRouteEntry } from "@/lib/preview/detect-preview-routes";

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
  const ref = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const current = routes.find((r) => r.path === currentPath) ?? routes[0];
  const filtered = routes.filter(
    (r) =>
      r.path.toLowerCase().includes(filter.toLowerCase()) ||
      r.label.toLowerCase().includes(filter.toLowerCase()),
  );

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function position() {
      const el = buttonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({
        top: r.bottom + 4,
        left: r.left + r.width / 2,
        width: Math.min(320, window.innerWidth - 24),
      });
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex min-w-0 flex-1 justify-center">
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

      {open &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[20000] rounded-lg border border-border bg-background py-1 shadow-xl ring-1 ring-border"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              transform: "translateX(-50%)",
            }}
          >
            {routes.length > 6 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search routes…"
                className="mx-2 mb-1 w-[calc(100%-16px)] rounded border border-border bg-surface px-2 py-1 text-[11px] outline-none"
              />
            )}
            <ul className="max-h-48 overflow-y-auto">
              {filtered.map((r) => (
                <li key={r.path}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-[11px] hover:bg-surface",
                      r.path === currentPath && "bg-accent/10",
                    )}
                    onClick={() => {
                      onSelect(r.path);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-foreground">{r.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
