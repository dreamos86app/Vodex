"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, ArrowRight } from "lucide-react";

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[DreamOS86] Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(239,68,68,0.06)_0%,transparent_60%)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/25">
          <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
        </div>

        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.03em] text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          DreamOS86 encountered an unexpected error. Your work is safe —
          this is a rendering issue, not a data loss event.
        </p>

        <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
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

        {error.digest && (
          <p className="mt-6 rounded-lg bg-surface px-3 py-1.5 font-mono text-[10.5px] text-muted-foreground ring-1 ring-border">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-2 text-[12px] text-muted-foreground/50">
          <p>If this keeps happening:</p>
          <Link
            href="/help"
            className="flex items-center gap-1 text-accent hover:underline"
          >
            Visit Help Center <ArrowRight className="size-3" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
