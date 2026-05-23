"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectIcon } from "@/components/projects/project-icon";
import { ProjectBanner } from "@/components/projects/project-banner";
import { readImportMeta, isZipImportProject } from "@/lib/projects/imported-project-state";

export type YourAppsProject = {
  id: string;
  name: string;
  gradient: string;
  status: string;
  framework?: string | null;
  updated_at: string;
  preview_url: string | null;
  icon_url?: string | null;
  icon_svg?: string | null;
  banner_svg?: string | null;
  metadata?: Record<string, unknown> | null;
};

function frameworkLabel(project: YourAppsProject): string | null {
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? project.metadata
      : null;
  if (meta && isZipImportProject(meta)) {
    const imp = readImportMeta(meta);
    const fw = imp.framework?.id ?? project.framework;
    if (fw && fw !== "unknown") return String(fw);
  }
  return project.framework && project.framework !== "unknown" ? project.framework : null;
}

function fileSummary(project: YourAppsProject): string | null {
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? project.metadata
      : null;
  if (!meta || !isZipImportProject(meta)) return null;
  const imp = readImportMeta(meta);
  if (imp.file_count && imp.file_count > 0) return `${imp.file_count.toLocaleString()} files`;
  if (imp.routes?.length) return `${imp.routes.length} routes`;
  return null;
}

export function YourAppsSection({ projects }: { projects: YourAppsProject[] }) {
  const hasApps = projects.length > 0;

  return (
    <section className="w-full" data-testid="your-apps-section">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-3.5 text-accent" strokeWidth={1.75} />
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Your apps
          </span>
        </div>
        {hasApps ? (
          <Link
            href="/projects"
            className="flex items-center gap-1 text-[11.5px] font-medium text-accent transition hover:underline"
          >
            View all
            <ArrowRight className="size-3" strokeWidth={2} />
          </Link>
        ) : null}
      </div>

      {hasApps ? (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {projects.map((p, i) => {
            const fw = frameworkLabel(p);
            const files = fileSummary(p);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/apps/${p.id}/builder`}
                  className="group flex w-[220px] flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-border transition hover:ring-accent/35 hover:shadow-md"
                >
                  <ProjectBanner
                    projectId={p.id}
                    bannerSvg={p.banner_svg}
                    previewUrl={p.preview_url}
                    title={p.name}
                    heightClass="h-[108px]"
                    previewOnly
                  />
                  <div className="flex items-start gap-2.5 p-3">
                    <ProjectIcon
                      projectId={p.id}
                      iconSvg={p.icon_svg}
                      iconUrl={p.icon_url}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{p.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {fw ? (
                          <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                            {fw}
                          </span>
                        ) : null}
                        {files ? (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                            {files}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
          <Link
            href="/create"
            className="flex w-[140px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-6 transition hover:border-accent/40 hover:bg-accent/5"
          >
            <Plus className="size-5 text-accent" strokeWidth={2} />
            <span className="text-[11.5px] font-medium text-muted-foreground">New app</span>
          </Link>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/40 px-6 py-10 text-center"
        >
          <p className="text-[14px] font-semibold text-foreground">No apps yet</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Describe what you want above — your first app will show up here.
          </p>
          <Link
            href="/create"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-accent/90"
          >
            Start building
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </Link>
        </motion.div>
      )}
    </section>
  );
}
