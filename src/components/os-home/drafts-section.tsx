"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FilePen } from "lucide-react";
import { ProjectIcon } from "@/components/projects/project-icon";
import { projectIconSrc } from "@/lib/projects/ensure-project-icon";
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {projects.slice(0, 8).map((p, i) => {
          const ui = computeProjectCardUiState(p as ProjectCardUiInput);
          const iconSrc = projectIconSrc(p.id, p.icon_svg, p.icon_url, p.updated_at);
          const isFailed = ui.visibility_status === "failed_attempt";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="overflow-hidden rounded-xl bg-surface ring-1 ring-border/70"
            >
              <Link href={`/apps/${p.id}/builder`} className="block p-3">
                <div className="flex items-center gap-2.5">
                  <ProjectIcon projectId={p.id} iconUrl={iconSrc} iconSvg={p.icon_svg} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ui.status_label}</p>
                  </div>
                </div>
                {isFailed ? (
                  <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300">Failed attempt — retry</p>
                ) : ui.primary_cta ? (
                  <p className="mt-2 text-[10px] font-medium text-accent">{ui.primary_cta.label}</p>
                ) : null}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
