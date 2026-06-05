"use client";

import Link from "next/link";
import { BookOpen, CircleHelp, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContextualHelp({
  guideHref,
  className,
  compact,
}: {
  guideHref: string;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Link
        href={guideHref}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground",
          className,
        )}
      >
        <BookOpen className="size-3" />
        Learn
      </Link>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Link
        href={guideHref}
        className="inline-flex items-center gap-1.5 rounded-xl bg-accent/10 px-3 py-1.5 text-[11px] font-semibold text-accent ring-1 ring-accent/20 transition hover:bg-accent/15"
      >
        <GraduationCap className="size-3.5" />
        Open guide
      </Link>
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground"
      >
        <BookOpen className="size-3.5" />
        Help Center
      </Link>
      <a
        href="mailto:support@vodex.dev"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border transition hover:text-foreground"
      >
        <CircleHelp className="size-3.5" />
        Need help?
      </a>
    </div>
  );
}

export function integrationGuideHref(providerId: string): string {
  const map: Record<string, string> = {
    lemonsqueezy: "lemon-squeezy",
    lemon_squeezy: "lemon-squeezy",
  };
  const slug = map[providerId] ?? providerId;
  if (["stripe", "paypal", "paddle", "lemon-squeezy", "revenuecat"].includes(slug)) {
    return `/help/payments/${slug}`;
  }
  if (["openai", "anthropic", "gemini"].includes(slug)) {
    return `/help/integrations/${slug}`;
  }
  return `/help/integrations/${slug}`;
}
