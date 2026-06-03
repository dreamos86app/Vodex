"use client";

import Link from "next/link";
import { Plug, KeyRound, ChevronRight } from "lucide-react";
import type { PublishSetupGap } from "@/lib/publish/integration-secret-readiness";

export function PublishSetupChecklist({
  projectId,
  gaps,
}: {
  projectId: string;
  gaps: PublishSetupGap[];
}) {
  if (gaps.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4"
      data-testid="publish-integrations-checklist"
    >
      <p className="text-[13px] font-semibold text-foreground">Finish setup before publish</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Connect integrations and add secrets so your live app works.
      </p>
      <ul className="mt-3 space-y-2">
        {gaps.map((g) => (
          <li key={`${g.kind}-${g.provider}`}>
            <Link
              href={`/apps/${projectId}/builder?tab=dashboard&section=${g.href}`}
              className="flex items-center gap-3 rounded-lg bg-background/80 px-3 py-2.5 ring-1 ring-border transition hover:ring-accent/40"
            >
              {g.kind === "integration" ? (
                <Plug className="size-4 shrink-0 text-accent" />
              ) : (
                <KeyRound className="size-4 shrink-0 text-accent" />
              )}
              <span className="min-w-0 flex-1 text-[12px] font-medium text-foreground">{g.message}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
