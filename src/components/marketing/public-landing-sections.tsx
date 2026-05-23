"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicLandingSecondaryCtas({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto mt-6 flex flex-wrap justify-center gap-3">
      <button
        type="button"
        onClick={onStart}
        data-testid="public-start-building"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-accent/90",
        )}
      >
        <Sparkles className="size-4" />
        Start building
        <ArrowRight className="size-3.5 opacity-80" />
      </button>
      <Link
        href="/explore"
        className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-[13px] font-semibold text-foreground transition hover:border-accent/30 hover:bg-surface/60"
      >
        See examples
      </Link>
    </div>
  );
}
