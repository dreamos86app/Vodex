"use client";

import { cn } from "@/lib/utils";
import { Zap, Shield, Rocket } from "lucide-react";

export type BuildTier = "quick" | "standard" | "production";

const TIERS: Array<{
  id: BuildTier;
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  { id: "quick", label: "Quick", desc: "Fast first version", icon: Zap },
  { id: "standard", label: "Standard", desc: "Best for most apps", icon: Shield },
  { id: "production", label: "Full polish", desc: "Extra checks & depth", icon: Rocket },
];

export function CreateBuildConfirmStep({
  selected,
  onSelect,
  cheaperRecommended,
  disabled,
}: {
  selected: BuildTier;
  onSelect: (t: BuildTier) => void;
  cheaperRecommended?: boolean;
  onConfirm?: () => void;
  onEditBlueprint?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold tracking-tight text-foreground">Choose build depth</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Pick how much detail DreamOS86 should generate for this version.
        </p>
        {cheaperRecommended && (
          <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400">
            Quick depth is recommended if you want to iterate faster.
          </p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {TIERS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(t.id)}
              className={cn(
                "rounded-2xl p-4 text-left ring-1 transition disabled:opacity-50",
                selected === t.id ? "bg-accent/10 ring-accent/40 shadow-sm" : "bg-surface ring-border hover:ring-accent/25",
              )}
            >
              <Icon className="size-5 text-accent" strokeWidth={1.75} />
              <p className="mt-3 text-[13px] font-semibold">{t.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
