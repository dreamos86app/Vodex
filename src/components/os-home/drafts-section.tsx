"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, FilePen } from "lucide-react";
import { ProjectIcon } from "@/components/projects/project-icon";
import {
  computeProjectCardUiState,
  type ProjectCardUiInput,
} from "@/lib/projects/project-visibility-status";
import type { YourAppsProject } from "@/components/os-home/your-apps-section";

export function DraftsSection({ projects }: { projects: YourAppsProject[] }) {
  if (projects.length === 0) return null;

  return (
    <section className="w-full" data-testid="drafts-section">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilePen className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Drafts
          </span>
        </div>
        <Link
          href="/projects?section=drafts"
          className="flex items-center gap-1 text-[11.5px] font-medium text-accent transition hover:underline"
        >
          View all
          <ArrowRight className="size-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="group/drafts relative">
        <div
          className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] snap-x snap-mandatory"
          data-testid="drafts-scroll-row"
        >
          {projects.map((p, i) => {
            const ui = computeProjectCardUiState(p as ProjectCardUiInput);
            const isFailed = ui.visibility_status === "failed_attempt";
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="w-[calc((100%-2.25rem)/2)] min-w-[168px] shrink-0 snap-start overflow-hidden rounded-xl bg-surface ring-1 ring-border/70 sm:w-[calc((100%-2.25rem)/3)] lg:w-[calc((100%-2.25rem)/4)]"
              >
                <Link href={`/apps/${p.id}/builder`} className="block p-3">
                  <div className="flex items-center gap-2.5">
                    <ProjectIcon
                      projectId={p.id}
                      iconSvg={p.icon_svg}
                      iconUrl={p.icon_url}
                      cacheKey={p.updated_at}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ui.status_label}</p>
                    </div>
                  </div>
                  {isFailed ? (
                    <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300">
                      Failed attempt — retry
                    </p>
                  ) : ui.primary_cta ? (
                    <p className="mt-2 text-[10px] font-medium text-accent">{ui.primary_cta.label}</p>
                  ) : null}
                </Link>
              </motion.div>
            );
          })}
        </div>
        {projects.length > 4 ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-background/90 to-transparent pr-0.5 opacity-0 transition group-hover/drafts:opacity-100"
            aria-hidden
          >
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
