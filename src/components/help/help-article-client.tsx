"use client";

import * as React from "react";
import Link from "next/link";
import { recordHelpView, getRecentHelpViews } from "@/lib/help/recently-viewed";
import { SetupChecklist } from "@/components/help/setup-checklist";

export function HelpArticleClient({
  href,
  title,
  category,
  providerId,
  projectId,
  checklist,
}: {
  href: string;
  title: string;
  category: string;
  providerId?: string;
  projectId?: string;
  checklist?: Array<{ id: string; label: string }>;
}) {
  const [recent, setRecent] = React.useState<ReturnType<typeof getRecentHelpViews>>([]);

  React.useEffect(() => {
    recordHelpView({ href, title, category });
    setRecent(getRecentHelpViews().filter((r) => r.href !== href));
  }, [href, title, category]);

  return (
    <div className="space-y-6">
      {checklist?.length && providerId ? (
        <SetupChecklist projectId={projectId} providerId={providerId} items={checklist} />
      ) : null}

      {recent.length > 0 ? (
        <div className="rounded-xl bg-muted/20 px-3 py-3 ring-1 ring-border/50 lg:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recently viewed
          </p>
          <ul className="mt-2 space-y-1">
            {recent.slice(0, 4).map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-[12px] text-accent hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
