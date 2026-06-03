"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { VisiblePresenceStatus } from "@/lib/presence/user-presence";

export type PresenceDotProps = {
  status: VisiblePresenceStatus;
  /** Tooltip for self view (e.g. Appearing offline) */
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeMap = {
  sm: "size-2.5 border-[1.5px]",
  md: "size-3 border-2",
} as const;

export function PresenceDot({ status, label, size = "md", className }: PresenceDotProps) {
  const online = status === "online";
  const title = label ?? (online ? "Online" : "Offline");

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      data-presence={status}
      className={cn(
        "vodex-presence-dot inline-block shrink-0 rounded-full border-background",
        sizeMap[size],
        online ? "vodex-presence-dot--online" : "vodex-presence-dot--offline",
        className,
      )}
    />
  );
}
