"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Slightly bolder custom heart for community likes. */
export function CommunityHeartButton({
  liked,
  count,
  onToggle,
  className,
  size = "md",
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const [burst, setBurst] = React.useState(0);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setBurst((n) => n + 1);
    onToggle();
  }

  const iconSize = size === "sm" ? 15 : 17;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "inline-flex -translate-x-0.5 items-center gap-1 rounded-lg px-1.5 py-1 transition-colors",
        liked ? "text-red-500" : "text-muted-foreground hover:text-red-400",
        className,
      )}
    >
      <motion.span
        key={burst}
        initial={{ scale: 0.72, rotate: liked ? -12 : 12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 560, damping: 14, mass: 0.55 }}
        className="relative inline-flex"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          aria-hidden
          className={cn("drop-shadow-sm", liked && "drop-shadow-[0_0_6px_rgba(239,68,68,0.45)]")}
        >
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={liked ? 0 : 2.25}
            strokeLinejoin="round"
          />
        </svg>
      </motion.span>
      <span className={cn("tabular-nums font-semibold", size === "sm" ? "text-[11px]" : "text-[12px]")}>
        {count}
      </span>
    </button>
  );
}
