"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  checklistPercent,
  getChecklistProgress,
  setChecklistItem,
} from "@/lib/help/setup-checklist-storage";

export function SetupChecklist({
  projectId,
  providerId,
  items,
}: {
  projectId?: string;
  providerId: string;
  items: Array<{ id: string; label: string }>;
}) {
  const [progress, setProgress] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!projectId) return;
    setProgress(getChecklistProgress(projectId, providerId));
  }, [projectId, providerId]);

  if (!items.length) return null;

  const pct = checklistPercent(items, progress);

  function toggle(id: string) {
    if (!projectId) return;
    const next = setChecklistItem(projectId, providerId, id, !progress[id]);
    setProgress(next);
  }

  return (
    <div className="rounded-xl bg-muted/30 px-3 py-3 ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Setup checklist
        </p>
        <span className="text-[11px] font-bold text-accent">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[12px]",
                !projectId && "opacity-60",
              )}
            >
              <input
                type="checkbox"
                disabled={!projectId}
                checked={Boolean(progress[item.id])}
                onChange={() => toggle(item.id)}
              />
              <span className={progress[item.id] ? "text-muted-foreground line-through" : ""}>
                {item.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
