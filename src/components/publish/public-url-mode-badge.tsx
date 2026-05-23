"use client";

import { Globe } from "lucide-react";
import { wildcardSubdomainEnabled } from "@/lib/publish/publish-config";
import { cn } from "@/lib/utils";

/** Shows honest public URL mode — path default unless DNS verified. */
export function PublicUrlModeBadge({ className }: { className?: string }) {
  const wildcard = wildcardSubdomainEnabled();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1",
        wildcard
          ? "bg-positive/10 text-positive ring-positive/20"
          : "bg-surface text-muted-foreground ring-border",
        className,
      )}
      title={
        wildcard
          ? "Wildcard DNS verified — subdomain URLs enabled"
          : "Path mode — public apps use /p/slug (no fake subdomain)"
      }
    >
      <Globe className="size-3" />
      {wildcard ? "Subdomain mode" : "Path mode (/p/slug)"}
    </span>
  );
}
