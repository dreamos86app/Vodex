"use client";

import * as React from "react";
import { Avatar, type AvatarProps } from "@/components/ui/avatar";
import { PresenceDot } from "@/components/presence/presence-dot";
import type { VisiblePresenceStatus } from "@/lib/presence/user-presence";
import { cn } from "@/lib/utils";

export type PresenceAvatarProps = AvatarProps & {
  status?: VisiblePresenceStatus | null;
  statusLabel?: string;
  showStatus?: boolean;
};

export function PresenceAvatar({
  status,
  statusLabel,
  showStatus = true,
  className,
  size = "md",
  ...avatarProps
}: PresenceAvatarProps) {
  const dotSize = size === "xs" || size === "sm" ? "sm" : "md";

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar size={size} className={className} {...avatarProps} />
      {showStatus && status ? (
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 z-10">
          <PresenceDot status={status} label={statusLabel} size={dotSize} />
        </span>
      ) : null}
    </span>
  );
}
