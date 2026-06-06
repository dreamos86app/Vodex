"use client";

import { CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthProviderCard({
  name,
  enabled,
  health,
  configured,
  onToggle,
  onConfigure,
}: {
  name: string;
  enabled: boolean;
  health: "ok" | "warn" | "off";
  configured?: boolean;
  onToggle?: (enabled: boolean) => void;
  onConfigure: () => void;
}) {
  const HealthIcon = health === "ok" ? CheckCircle2 : health === "warn" ? AlertTriangle : Circle;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl bg-surface p-4 ring-1 ring-border/80"
      data-testid={`auth-provider-${name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-foreground">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <HealthIcon
              className={cn(
                "size-3.5",
                health === "ok" && "text-emerald-600",
                health === "warn" && "text-amber-600",
                health === "off" && "text-muted-foreground",
              )}
            />
            {health === "ok" ? "Healthy" : health === "warn" ? "Needs attention" : "Disabled"}
            {configured ? " · Configured" : ""}
          </p>
        </div>
        {onToggle ? (
          <label className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Enable</span>
            <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          </label>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onConfigure}
        className="w-full rounded-lg bg-background px-3 py-2 text-[12px] font-semibold text-foreground ring-1 ring-border hover:ring-accent/30"
      >
        Configure
      </button>
    </div>
  );
}
