"use client";

import * as React from "react";
import { History, RotateCcw } from "lucide-react";
import type { EditorCheckpoint } from "@/lib/editor/checkpoints";
import { CHECKPOINT_STAGE_LABELS } from "@/lib/editor/checkpoints";
import { Button } from "@/components/ui/button";

export function CheckpointTimeline({
  checkpoints,
  onRollback,
  busyId,
}: {
  checkpoints: EditorCheckpoint[];
  onRollback: (id: string) => void | Promise<void>;
  busyId?: string | null;
}) {
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  if (checkpoints.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Checkpoints are saved before builds, edits, polish, and publish.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="checkpoint-timeline">
      {checkpoints.map((c) => {
        const changed = c.changedPaths?.length
          ? c.changedPaths
          : c.files.slice(0, 4).map((f) => f.path);
        const confirming = confirmId === c.id;
        return (
          <li key={c.id} className="rounded-lg border border-border px-2 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2 text-[12px]">
                <History className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{c.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {CHECKPOINT_STAGE_LABELS[c.stage] ?? c.stage} · {c.fileCount} files ·{" "}
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                  {changed.length > 0 && (
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {changed.slice(0, 3).join(", ")}
                      {changed.length > 3 ? ` +${changed.length - 3} more` : ""}
                    </p>
                  )}
                </div>
              </div>
              {!confirming ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyId === c.id}
                  onClick={() => setConfirmId(c.id)}
                >
                  <RotateCcw className="size-3" />
                  Restore
                </Button>
              ) : (
                <div className="flex shrink-0 flex-col gap-1">
                  <p className="text-[10px] font-medium text-destructive">Restore this snapshot?</p>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === c.id}
                      onClick={() => {
                        void onRollback(c.id);
                        setConfirmId(null);
                      }}
                    >
                      Confirm
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
