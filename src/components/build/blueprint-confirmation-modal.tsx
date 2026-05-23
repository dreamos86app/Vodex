"use client";

import * as React from "react";
import { X, Rocket, Sparkles, Minimize2 } from "lucide-react";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { AppBlueprintPanel } from "@/components/build/app-blueprint-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  blueprint: AppBlueprint | null;
  loading?: boolean;
  onClose: () => void;
  onBuildNow: () => void;
  onEditBlueprint: () => void;
  onCheaperMode: () => void;
  onPremiumMode: () => void;
};

export function BlueprintConfirmationModal({
  open,
  blueprint,
  loading,
  onClose,
  onBuildNow,
  onEditBlueprint,
  onCheaperMode,
  onPremiumMode,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className={cn(
          "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background shadow-xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Review your app blueprint</p>
            <p className="text-[11px] text-muted-foreground">Approve before we run a full build</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4">
          {loading || !blueprint ? (
            <p className="text-[13px] text-muted-foreground">Designing the app structure…</p>
          ) : (
            <AppBlueprintPanel blueprint={blueprint} />
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" className="flex-1" onClick={onBuildNow} disabled={!blueprint || loading}>
              <Rocket className="size-4" />
              Build now
            </Button>
            <Button type="button" variant="secondary" onClick={onEditBlueprint} disabled={!blueprint}>
              Edit blueprint
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCheaperMode}>
              <Minimize2 className="size-3.5" />
              Cheaper mode
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onPremiumMode}>
              <Sparkles className="size-3.5" />
              Premium quality
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Unused reserved credits are returned after the build completes.
          </p>
        </div>
      </div>
    </div>
  );
}
