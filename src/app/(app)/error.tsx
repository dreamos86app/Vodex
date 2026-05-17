"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Home, Sparkles, ArrowRight } from "lucide-react";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[DreamOS86] App error:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center"
    >
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(239,68,68,0.04)_0%,transparent_60%)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/25">
          <AlertTriangle className="size-7 text-destructive" strokeWidth={1.5} />
        </div>

        <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.03em] text-foreground">
          Page failed to load
        </h1>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Something unexpected happened while rendering this section.
          Your data and projects are safe. Try retrying or return to the workspace.
        </p>

        {isDev && error.message && (
          <div className="mt-4 w-full rounded-xl bg-destructive/5 px-4 py-3 text-left ring-1 ring-destructive/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70">
              Dev error
            </p>
            <p className="mt-1 font-mono text-[11.5px] text-destructive/90 break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-accent/90"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} />
            Retry
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-surface px-4 py-2 text-[13px] font-semibold text-foreground ring-1 ring-border transition hover:ring-accent/30"
          >
            <Home className="size-3.5" strokeWidth={1.75} />
            Creation home
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-2 rounded-xl bg-surface px-4 py-2 text-[13px] font-semibold text-foreground ring-1 ring-border transition hover:ring-accent/30"
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            My apps
          </Link>
        </div>

        {error.digest && (
          <p className="mt-5 rounded-lg bg-surface px-3 py-1.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border">
            Error ID: {error.digest}
          </p>
        )}

        <Link
          href="/help"
          className="mt-4 flex items-center gap-1 text-[11.5px] text-muted-foreground/50 transition hover:text-muted-foreground"
        >
          Visit Help Center <ArrowRight className="size-3" strokeWidth={2} />
        </Link>
      </div>
    </motion.div>
  );
}
