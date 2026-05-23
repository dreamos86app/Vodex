"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus, Search, Star, LayoutGrid, List,
  Sparkles, Loader2, Upload, AppWindow,
} from "lucide-react";
import { Button } from "@/components/ui/button";  
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { variants } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTimedLoading } from "@/lib/hooks/use-timed-loading";
import type { Project } from "@/lib/supabase/types";
import { ZipImportWizard } from "@/components/apps/zip-import-wizard";
import { ProjectIcon } from "@/components/projects/project-icon";
import { ProjectBanner } from "@/components/projects/project-banner";
import { LIFECYCLE_META, readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";
import {
  importedStatusLabel,
  isZipImportProject,
  resolveImportedLifecycleStatus,
  readImportMeta,
} from "@/lib/projects/imported-project-state";

type ProjectRow = Project & {
  lifecycle_status?: string;
  lifecycle_label?: string;
  public_url?: string | null;
  banner_svg?: string | null;
};

const STATUS_CONFIG: Record<Project["status"], { label: string; dot: string; text: string }> = {
  live: { label: "Live", dot: "bg-positive animate-pulse", text: "text-positive" },
  staging: { label: "Staging", dot: "bg-amber-400", text: "text-amber-400" },
  draft: { label: "Draft", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  building: { label: "Building", dot: "bg-accent animate-pulse", text: "text-accent" },
  error: { label: "Error", dot: "bg-destructive", text: "text-destructive" },
};

function cardStatusLabel(project: ProjectRow): { label: string; dot: string; text: string } {
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  if (isZipImportProject(meta)) {
    const imp = readImportMeta(meta);
    const st = resolveImportedLifecycleStatus(meta, imp.file_count ?? 0, false);
    const label = st ? importedStatusLabel(st) : "Imported ZIP";
    const tone =
      st === "imported_preview_ready"
        ? "text-positive"
        : st === "imported_error"
          ? "text-destructive"
          : st === "imported_needs_setup"
            ? "text-amber-400"
            : "text-muted-foreground";
    const dot =
      st === "imported_preview_ready"
        ? "bg-positive"
        : st === "imported_error"
          ? "bg-destructive"
          : st === "imported_needs_setup"
            ? "bg-amber-400"
            : "bg-accent";
    return { label, dot, text: tone };
  }
  const ls = project.lifecycle_status ?? readLifecycleFromMetadata(project.metadata).lifecycle_status;
  if (ls && ls in LIFECYCLE_META) {
    const m = LIFECYCLE_META[ls as keyof typeof LIFECYCLE_META];
    const tone =
      ls === "published"
        ? "text-positive"
        : ls === "building" || ls === "blueprint_generating"
          ? "text-accent"
          : ls === "failed" || ls === "needs_attention"
            ? "text-destructive"
            : "text-muted-foreground";
    const dot =
      ls === "published"
        ? "bg-positive animate-pulse"
        : ls === "building" || ls === "blueprint_generating"
          ? "bg-accent animate-pulse"
          : ls === "failed" || ls === "needs_attention"
            ? "bg-destructive"
            : "bg-muted-foreground/40";
    return { label: project.lifecycle_label ?? m.userLabel, dot, text: tone };
  }
  const metaFallback =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  const buildStatus = typeof metaFallback.build_status === "string" ? metaFallback.build_status : null;
  if (buildStatus === "completed") {
    return { label: "Generated", dot: "bg-positive", text: "text-positive" };
  }
  return STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;
}

function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 ring-border">
      <div className="h-20 bg-muted/40" />
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <div className="size-10 rounded-xl bg-muted/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-muted/60" />
            <div className="h-2 w-1/2 rounded bg-muted/50" />
          </div>
        </div>
        <div className="h-2 w-full rounded bg-muted/40" />
        <div className="h-8 w-full rounded-lg bg-muted/50" />
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const cfg = cardStatusLabel(project);
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  const appName =
    (typeof (project as Project & { app_name?: string }).app_name === "string"
      ? (project as Project & { app_name: string }).app_name
      : null) ||
    (typeof meta.app_name === "string" ? meta.app_name : null) ||
    project.name;
  const shortDesc =
    (project as Project & { short_description?: string }).short_description ||
    project.description;
  const iconSvg =
    typeof (project as Project & { icon_svg?: string }).icon_svg === "string"
      ? (project as Project & { icon_svg: string }).icon_svg
      : null;
  const bannerSvg = project.banner_svg ?? null;
  const ls = project.lifecycle_status ?? readLifecycleFromMetadata(project.metadata).lifecycle_status;
  const isZipImport =
    meta.source === "zip_import" ||
    Boolean((meta.import as Record<string, unknown> | undefined)?.original_name);
  const canPreview =
    Boolean(project.preview_url) &&
    ls &&
    ["generated", "preview_ready", "publish_ready", "published"].includes(ls);
  const canPublish = ls === "preview_ready" || ls === "publish_ready" || ls === "published";
  const needsRepair = ls === "needs_attention" || ls === "failed";
  const publicUrl = project.public_url ?? null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-surface ring-1 ring-border transition hover:ring-accent/30 hover:shadow-lg"
    >
      <Link
        href={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-0"
      />
      <ProjectBanner
        projectId={project.id}
        bannerSvg={bannerSvg}
        previewUrl={project.preview_url}
        title={appName}
        className="pointer-events-none"
        previewOnly
      />

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <ProjectIcon projectId={project.id} iconSvg={iconSvg} iconUrl={project.icon_url} size={40} />
            <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
              {appName}
            </p>
            {shortDesc && (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{shortDesc}</p>
            )}
            {publicUrl && (
              <p className="mt-1 truncate text-[10px] font-medium text-positive">{publicUrl}</p>
            )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-background px-2 py-0.5">
            <span className={cn("size-1.5 rounded-full", cfg.dot)} />
            <span className={cn("text-[10px] font-medium", cfg.text)}>{cfg.label}</span>
          </div>
        </div>

        <div className="pointer-events-auto relative z-[2] mt-2 flex flex-wrap gap-2">
          <Link
            href={`/apps/${project.id}/builder`}
            className="rounded-lg bg-accent/12 px-2.5 py-1 text-[10.5px] font-semibold text-accent ring-1 ring-accent/20 transition hover:bg-accent hover:text-white"
          >
            Open builder
          </Link>
          {needsRepair && (
            <Link
              href={`/apps/${project.id}/builder?repair=1`}
              className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[10.5px] font-semibold text-amber-700 ring-1 ring-amber-500/20"
            >
              Fix issues
            </Link>
          )}
          {canPreview && project.preview_url && (
            <a
              href={project.preview_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg bg-surface px-2.5 py-1 text-[10.5px] font-medium text-foreground ring-1 ring-border transition hover:ring-accent/25"
            >
              Preview
            </a>
          )}
          {canPublish && (
            <Link
              href={`/apps/${project.id}/dashboard?tab=publish`}
              className="rounded-lg bg-positive/10 px-2.5 py-1 text-[10.5px] font-semibold text-positive ring-1 ring-positive/20"
            >
              Publish
            </Link>
          )}
          <Link
            href={`/apps/${project.id}/dashboard`}
            className="rounded-lg bg-surface px-2.5 py-1 text-[10.5px] font-medium text-foreground ring-1 ring-border transition hover:ring-accent/25"
          >
            Dashboard
          </Link>
        </div>

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {isZipImport && (
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/20">
                Imported ZIP
              </span>
            )}
            <span className="truncate">{project.framework}</span>
            <span>{new Date(project.updated_at).toLocaleDateString()}</span>
          </div>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex shrink-0 items-center justify-center rounded-lg p-1.5 text-muted-foreground transition hover:bg-background hover:text-amber-400"
            aria-label={project.is_favorite ? "Remove favorite" : "Add favorite"}
          >
            <Star className={cn("size-3.5", project.is_favorite && "fill-amber-400 text-amber-400")} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function ProjectsView() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuthStore();
  const [projects, setProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const isLoading = useTimedLoading(loading, 1000);
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"updated" | "name">("updated");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [showImport, setShowImport] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const lastLoadRef = React.useRef(0);

  const loadProjects = React.useCallback((reconcile = false) => {
    if (!profile?.id) return;
    const now = Date.now();
    if (!reconcile && now - lastLoadRef.current < 30_000 && projects.length > 0) return;
    lastLoadRef.current = now;
    setLoading(true);
    setLoadError(null);
    const qs = reconcile ? "?reconcile=1" : "";
    fetch(`/api/projects${qs}`)
      .then((r) => r.json())
      .then((body: { projects?: ProjectRow[] }) => {
        setProjects(body.projects ?? []);
        setLoading(false);
      })
      .catch(() => {
        void Promise.resolve(
          supabase
            .from("projects")
            .select("*, app_name, short_description, category, icon_svg, build_status, icon_url")
            .eq("owner_id", profile.id)
            .order("updated_at", { ascending: false }),
        )
          .then(({ data, error }) => {
            if (error) throw error;
            setProjects((data as ProjectRow[]) ?? []);
            setLoading(false);
          })
          .catch(() => {
            setLoadError("Could not load your apps. Try again.");
            setLoading(false);
          });
      });
  }, [profile?.id, supabase, projects.length]);

  React.useEffect(() => {
    if (!profile?.id) {
      const t = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(t);
    }
    loadProjects(true);
    const onFocus = () => {
      if (Date.now() - lastLoadRef.current > 120_000) loadProjects(false);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [profile?.id, loadProjects]);

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      const appName = ((p as ProjectRow).app_name ?? "").toLowerCase();
      const matchSearch = !q || name.includes(q) || appName.includes(q);
      const ls = p.lifecycle_status ?? readLifecycleFromMetadata(p.metadata).lifecycle_status;
      const matchStatus = statusFilter === "all" || ls === statusFilter || p.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="show"
      className="dashboard-shell space-y-5 overflow-x-hidden pb-10 safe-area-pad-b"
    >
      {/* Header */}
      <motion.div variants={variants.fadeUp} className="flex flex-wrap items-center gap-2 overflow-x-hidden sm:gap-3">
        <div className="relative min-w-[140px] flex-1 basis-full sm:basis-auto sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="h-9 w-full rounded-[var(--radius-lg)] bg-surface pl-9 pr-3 text-[13px] text-foreground ring-1 ring-border outline-none focus:ring-accent/40"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-[var(--radius-lg)] bg-surface px-2 text-[12px] text-foreground ring-1 ring-border outline-none"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="building">Building</option>
          <option value="generated">Generated</option>
          <option value="published">Published</option>
          <option value="needs_attention">Needs attention</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "updated" | "name")}
          className="h-9 rounded-[var(--radius-lg)] bg-surface px-2 text-[12px] text-foreground ring-1 ring-border outline-none"
          aria-label="Sort projects"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>

        <div className="flex rounded-lg ring-1 ring-border">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center justify-center p-2 transition first:rounded-l-lg last:rounded-r-lg",
                view === v ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "grid" ? <LayoutGrid className="size-4" strokeWidth={1.75} /> : <List className="size-4" strokeWidth={1.75} />}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowImport(true)}
        >
          <Upload className="size-3.5" strokeWidth={1.75} />
          Import ZIP
        </Button>
        <Button variant="accent" size="sm" className="gap-1.5" onClick={() => router.push("/create")}>
          <Plus className="size-3.5" strokeWidth={2} />
          New app
        </Button>
      </motion.div>

      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 ring-1 ring-destructive/20">
          <p className="text-[13px] text-destructive">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => loadProjects(true)}>
            Retry
          </Button>
        </div>
      )}

      {/* ZIP import wizard */}
      {showImport && (
        <ZipImportWizard
          onClose={() => setShowImport(false)}
          onComplete={() => {
            setShowImport(false);
            loadProjects(true);
          }}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div className={cn(
          view === "grid"
            ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "space-y-2",
        )}>
          {Array.from({ length: view === "grid" ? 6 : 4 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        !search ? (
          <motion.div
            variants={variants.fadeUp}
            className="flex flex-col items-center gap-8 py-16 text-center"
          >
            <div className="relative">
              <div className="absolute -inset-8 animate-pulse rounded-full bg-accent/5 blur-2xl" />
              <div className="relative flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet-500/20 ring-1 ring-accent/20">
                <AppWindow className="size-9 text-accent" strokeWidth={1.25} />
              </div>
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                Build your first app
              </h2>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Describe what you want in plain English. DreamOS86 generates routes, UI, database schema, auth, and APIs.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href="/create"
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-accent/90"
              >
                Create your app
              </Link>
              <Link
                href="/templates"
                className="flex items-center gap-2 rounded-xl bg-surface px-5 py-2.5 text-[13.5px] font-semibold text-foreground ring-1 ring-border transition hover:ring-accent/30"
              >
                Browse templates
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "SaaS dashboard", prompt: "Build a SaaS dashboard with analytics, team management, billing, and role-based access control.", desc: "Auth, billing, analytics" },
                { label: "Mobile app", prompt: "Build a mobile app with React Native, authentication, push notifications, and a REST API backend.", desc: "React Native + API" },
                { label: "AI tool", prompt: "Build an AI-powered tool with LLM integration, streaming responses, prompt management, and user history.", desc: "LLM-powered workflow" },
              ].map((idea) => (
                <button
                  key={idea.label}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/create?prompt=${encodeURIComponent(idea.prompt)}&mode=build&autostart=1`,
                    )
                  }
                  className="rounded-xl bg-surface p-4 text-left ring-1 ring-border transition hover:ring-accent/30 hover:bg-surface/80"
                >
                  <p className="text-[13px] font-semibold text-foreground">{idea.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{idea.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <EmptyState
            icon={<Search className="size-8 text-muted-foreground/30" strokeWidth={1.25} />}
            title="No matching projects"
            description="Try a different search term or clear the filter."
          />
        )
      ) : (
        <div className={cn(
          view === "grid"
            ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "space-y-2",
        )}>
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
