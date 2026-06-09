"use client";

import { cn } from "@/lib/utils";
import { GROUP_CATEGORIES } from "@/lib/community/group-categories";
import { Check } from "lucide-react";

export function GroupCategoryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(cat: string) {
    if (value.includes(cat)) {
      const next = value.filter((c) => c !== cat);
      onChange(next.length ? next : ["General"]);
    } else {
      onChange([...value, cat]);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">Select one or more — shown as tags on your group.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GROUP_CATEGORIES.map((cat) => {
          const checked = value.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggle(cat)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] ring-1 transition",
                checked
                  ? "bg-blue-500/10 text-blue-700 ring-blue-500/30 dark:text-blue-300"
                  : "bg-surface text-foreground ring-border hover:ring-blue-500/20",
              )}
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border transition",
                  checked ? "border-blue-500 bg-blue-500 text-white" : "border-border bg-background",
                )}
              >
                {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
              <span className="font-medium">{cat}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
