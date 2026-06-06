"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Hammer, ArrowRight, Loader2 } from "lucide-react";
import { ProjectIcon } from "@/components/projects/project-icon";
import type { YourAppsProject } from "@/components/os-home/your-apps-section";

export function BuildingSection({ projects }: { projects: YourAppsProject[] }) {
  if (projects.length === 0) return null;

  return (
    <section className="w-full" data-testid="building-section">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer className="size-3.5 text-amber-600" strokeWidth={1.75} />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Building
          </span>
        </div>
        <Link
          href="/projects?section=building"
          className="flex items-center gap-1 text-[11.5px] font-medium text-accent transition hover:underline"
        >
          View all
          <ArrowRight className="size-3" strokeWidth={2} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice(0, 6).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              href={`/apps/${p.id}/builder`}
              className="flex items-center gap-3 rounded-xl bg-amber-500/5 px-3 py-2.5 ring-1 ring-amber-500/20 transition hover:ring-amber-500/35"
            >
              <ProjectIcon
                projectId={p.id}
                iconSvg={p.icon_svg}
                iconUrl={p.icon_url}
                cacheKey={p.updated_at}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-foreground">{p.name}</p>
                <p className="flex items-center gap-1 text-[10px] text-amber-800 dark:text-amber-200">
                  <Loader2 className="size-3 animate-spin" />
                  Build in progress
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
