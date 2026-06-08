"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ClipboardList, Rocket, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { AppBlueprintPanel } from "@/components/build/app-blueprint-panel";

export function AppPlanInlineCard({
  blueprint,
  loading,
  onBuildThisApp,
  className,
}: {
  blueprint: AppBlueprint | null;
  loading?: boolean;
  onBuildThisApp: () => void;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-2xl bg-gradient-to-br from-accent/[0.07] via-background to-violet-500/[0.05] ring-1 ring-accent/20",
        className,
      )}
      data-testid="app-plan-inline-card"
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <ClipboardList className="size-4 text-accent" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">App Blueprint</p>
          <p className="text-[11px] text-muted-foreground">
            Product blueprint only — no files are generated until you build.
          </p>
        </div>
      </div>

      <div className="px-3 py-3">
        {loading ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-4 py-6 text-[12px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-accent" strokeWidth={1.75} />
            Preparing plan…
          </div>
        ) : blueprint ? (
          <AppBlueprintPanel blueprint={blueprint} compact showCreditReserve />
        ) : (
          <p className="text-[12px] text-muted-foreground">Could not load plan — try again.</p>
        )}
      </div>

      {blueprint && !loading ? (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
          <p className="mb-2 text-[10.5px] text-muted-foreground">
            Credits are charged only for completed work. Unused work is not charged.
          </p>
          <button
            type="button"
            data-testid="build-this-app-btn"
            onClick={onBuildThisApp}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            <Rocket className="size-4" strokeWidth={1.75} />
            Build full app
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
