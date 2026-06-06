"use client";

import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublishReadinessCard = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "loading";
  detail?: string;
};

function StatusIcon({ status }: { status: PublishReadinessCard["status"] }) {
  if (status === "loading") return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (status === "pass") return <CheckCircle2 className="size-5 text-emerald-600" strokeWidth={1.75} />;
  if (status === "warn") return <AlertTriangle className="size-5 text-amber-600" strokeWidth={1.75} />;
  return <XCircle className="size-5 text-destructive" strokeWidth={1.75} />;
}

export function PublishReadinessCards({
  cards,
  className,
}: {
  cards: PublishReadinessCard[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)} data-testid="publish-readiness-cards">
      {cards.map((card) => (
        <div
          key={card.id}
          className={cn(
            "flex min-h-[72px] gap-3 rounded-xl px-3.5 py-3 ring-1",
            card.status === "pass" && "bg-emerald-500/5 ring-emerald-500/20",
            card.status === "warn" && "bg-amber-500/5 ring-amber-500/25",
            card.status === "fail" && "bg-destructive/5 ring-destructive/20",
            card.status === "loading" && "bg-surface/80 ring-border/70",
          )}
        >
          <StatusIcon status={card.status} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">{card.label}</p>
            {card.detail ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{card.detail}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
