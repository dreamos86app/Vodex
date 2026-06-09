"use client";

import { AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function BuildNoFilesYetCard({
  className,
  variant = "no_files",
}: {
  className?: string;
  variant?: "no_files" | "hard_timeout";
}) {
  const isTimeout = variant === "hard_timeout";

  return (
    <div
      className={cn(
        "mr-6 rounded-2xl px-3.5 py-3 ring-2 sm:mr-10",
        isTimeout
          ? "bg-amber-50/60 ring-amber-400/50 dark:bg-amber-950/20"
          : "bg-rose-50/60 ring-rose-400/50 dark:bg-rose-950/20",
        className,
      )}
      data-testid="build-no-files-yet-card"
      data-variant={variant}
    >
      <div className="flex items-start gap-2">
        {isTimeout ? (
          <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
        ) : (
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
        )}
        <div>
          <p
            className={cn(
              "text-[12px] font-semibold",
              isTimeout
                ? "text-amber-800 dark:text-amber-200"
                : "text-rose-800 dark:text-rose-200",
            )}
          >
            {isTimeout ? "Build timed out" : "No files generated yet"}
          </p>
          <p
            className={cn(
              "mt-1 text-[11px] leading-relaxed",
              isTimeout
                ? "text-amber-700/90 dark:text-amber-300/90"
                : "text-rose-700/90 dark:text-rose-300/90",
            )}
          >
            {isTimeout ? (
              <>
                This build exceeded the maximum runtime. Use{" "}
                <span className="font-medium">Continue generation</span> to resume, or switch to{" "}
                <span className="font-medium">Automatic</span> for cost-optimized routing.
              </>
            ) : (
              <>
                The model has not returned usable source files in time. If the build pauses, use{" "}
                <span className="font-medium">Continue generation</span> to resume route-by-route —
                or try a faster model.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
