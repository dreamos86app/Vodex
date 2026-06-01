"use client";

import * as React from "react";
import { Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string | null | undefined;
  className?: string;
};

export function ProjectBillingBadge({ projectId, className }: Props) {
  const [label, setLabel] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!projectId) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/billing-context`, {
          credentials: "include",
        });
        const j = (await res.json()) as { label?: string };
        if (!cancelled && res.ok && j.label) setLabel(j.label);
      } catch {
        if (!cancelled) setLabel(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!projectId) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground",
        className,
      )}
      title="Whose credits are used for AI in this project"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={1.6} />
      ) : (
        <Wallet className="size-3 text-accent/80" strokeWidth={1.6} />
      )}
      <span>{loading ? "Billing…" : label ?? "Your personal credits"}</span>
    </div>
  );
}
