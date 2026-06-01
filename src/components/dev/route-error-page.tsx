"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { isChunkLoadError, safeChunkReloadOnce } from "@/lib/navigation/chunk-load-recovery";
import { RouteErrorOwnerDiagnostics } from "@/components/dev/route-error-owner-diagnostics";
import type { RouteErrorBoundary } from "@/lib/dev/route-error-context";

export function RouteErrorPage({
  error,
  unstable_retry,
  boundary,
  title = "Something went wrong",
  description = "Vodex encountered an unexpected error. Your work is safe — this is a rendering issue, not a data loss event.",
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
  boundary: RouteErrorBoundary;
  title?: string;
  description?: string;
}) {
  const chunkError = isChunkLoadError(error);
  const heading = chunkError ? "This page took too long to load" : title;
  const body = chunkError
    ? "A script chunk timed out — common while the dev server compiles. Retry once; your projects are safe."
    : description;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(239,68,68,0.06)_0%,transparent_60%)]" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/25">
          <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
        </div>

        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.03em] text-foreground">{heading}</h1>
        <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-muted-foreground">{body}</p>

        <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              if (chunkError && safeChunkReloadOnce()) return;
              unstable_retry();
            }}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-accent/90"
          >
            <RotateCcw className="size-4" strokeWidth={2} />
            Retry
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-surface px-5 py-2.5 text-[13.5px] font-semibold text-foreground ring-1 ring-border transition hover:ring-accent/30"
          >
            <Home className="size-4" strokeWidth={1.75} />
            Go home
          </Link>
        </div>

        <RouteErrorOwnerDiagnostics error={error} boundary={boundary} />
      </div>
    </div>
  );
}
