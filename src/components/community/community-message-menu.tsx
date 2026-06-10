"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommunityMessageMenu({
  onEdit,
  onDelete,
  className,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!onEdit && !onDelete) return null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Message options"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-xl bg-background py-1 shadow-xl ring-1 ring-border">
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-muted/60"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
