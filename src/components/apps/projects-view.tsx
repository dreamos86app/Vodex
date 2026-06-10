"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus, Search, LayoutGrid, List,
  Sparkles, Loader2, Upload, AppWindow,
} from "lucide-react";
import { FavoriteStarButton } from "@/components/projects/favorite-star-button";
import { Button } from "@/components/ui/button";  
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { variants } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Project } from "@/lib/supabase/types";
import { ZipImportWizard } from "@/components/apps/zip-import-wizard";
import { ProjectIcon } from "@/components/projects/project-icon";
import { ProjectBanner } from "@/components/projects/project-banner";
import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";
import {
  getProjectCardActions,
  getProjectCardStatus,
  getUserSafeProjectBadges,
  isImportedAppWithoutPreview,
  resolveProjectCardStatus,
} from "@/lib/projects/user-safe-project-badges";
import { projectIconSrc } from "@/lib/projects/ensure-project-icon";
import { resolvePreviewIframeUrl } from "@/lib/preview/preview-iframe-url-resolver";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { subscribeProjectCatalogUpdated } from "@/lib/projects/project-catalog-sync";
import { resolveProjectDisplayName } from "@/lib/projects/provisional-app-name";
import type { ProjectCardStatus } from "@/lib/projects/project-card-status";
import { computeProjectCardUiState } from "@/lib/projects/project-visibility-status";
import { ProjectCardOverflowMenu } from "@/components/apps/project-card-overflow-menu";
import { sanitizeStoredDescription } from "@/lib/projects/derive-user-facing-description";

type ProjectRow = Omit<Project, "metadata"> & {
  metadata?: Record<string, unknown> | null;
  app_name?: string | null;
  short_description?: string | null;
  category?: string | null;
  icon_svg?: string | null;
  build_status?: string | null;
  icon_url?: string | null;
  published_subdomain?: string | null;
  lifecycle_status?: string;
  lifecycle_label?: string;
  card_status?: ProjectCardStatus;
  visibility_section?: string;
  visibility_status?: string;
  status_label?: string;
  public_url?: string | null;
  banner_svg?: string | null;
  is_favorite?: boolean;
};

function cardStatusLabel(project: ProjectRow) {
  return getProjectCardStatus(project, {
    lifecycleStatus: project.lifecycle_status,
    lifecycleLabel: project.lifecycle_label,
  });
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

function ProjectCard({
  project,
  onToggleFavorite,
  onRefresh,
  isAdmin,
}: {
  project: ProjectRow;
  onToggleFavorite: (projectId: string, next: boolean) => void;
  onRefresh?: () => void;
  isAdmin: boolean;
}) {
  const cfg = cardStatusLabel(project);
  const cardStatus = resolveProjectCardStatus(project);
  const actions = getProjectCardActions(project, {
    lifecycleStatus: project.lifecycle_status,
    lifecycleLabel: project.lifecycle_label,
    isAdmin,
  });
  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  const appName = resolveProjectDisplayName({
    app_name:
      (typeof (project as Project & { app_name?: string }).app_name === "string"
        ? (project as Project & { app_name: string }).app_name
        : null) ||
      (typeof meta.app_name === "string" ? meta.app_name : null) ||
      null,
    name: project.name,
  });
  const shortDesc = sanitizeStoredDescription(
    (project as Project & { short_description?: string }).short_description || project.description,
    { originalPrompt: project.description, appName },
  );
  const iconSvg =
    typeof (project as Project & { icon_svg?: string }).icon_svg === "string"
      ? (project as Project & { icon_svg: string }).icon_svg
      : null;
  const bannerSvg = project.banner_svg ?? null;
  const ls = project.lifecycle_status ?? readLifecycleFromMetadata(project.metadata).lifecycle_status;
  const importedPending = isImportedAppWithoutPreview(project);
  const previewRenderable = meta.preview_renderable === true;
  const canPreview =
    cardStatus === "ready" && (Boolean(project.preview_url) || previewRenderable);
  const cardFramePreviewUrl = `/api/projects/${project.id}/preview-html?format=frame&route=${encodeURIComponent("/")}`;
  const resolvedBannerPreviewUrl =
    canPreview && !importedPending
      ? resolvePreviewIframeUrl({
          projectId: project.id,
          route: "/",
          artifactId:
            typeof meta.preview_build_job_id === "string" ? meta.preview_build_job_id : null,
          candidates: [
            { source: "app_card.preview_url", url: project.preview_url },
            { source: "generated_fallback", url: cardFramePreviewUrl },
          ],
        }).normalizedPreviewUrl
      : null;
  const canPublish =
    cardStatus === "ready" &&
    (ls === "preview_ready" || ls === "publish_ready" || ls === "published" || ls === "imported_preview_ready");
  const needsRepair =
    (cardStatus === "preview_failed" || cardStatus === "failed") &&
    ls === "needs_attention";
  const publicUrl = project.public_url ?? null;
  const iconSrc = projectIconSrc(
    project.id,
    iconSvg,
    project.icon_url,
    project.updated_at,
  );
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-surface shadow-[0_8px_28px_-14px_rgba(15,23,42,0.18)] ring-1 ring-border/80 transition hover:shadow-[0_12px_32px_-12px_rgba(37,99,235,0.22)] hover:ring-accent/25"
    >
      <Link
        href={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="block border-b border-border/40"
      >
        <ProjectBanner
          projectId={project.id}
          bannerSvg={bannerSvg}
          previewUrl={resolvedBannerPreviewUrl}
          title={appName}
          className="pointer-events-none"
          previewOnly={!canPreview}
          importedPendingSetup={importedPending}
          iconSrc={iconSrc}
        />
      </Link>

      <div className="relative z-[1] flex flex-1 flex-col gap-3 p-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/projects/${project.id}`} className="flex min-w-0 items-start gap-2.5">
            <ProjectIcon
              projectId={project.id}
              name={appName}
              iconSvg={iconSvg}
              iconUrl={project.icon_url}
              cacheKey={project.updated_at}
              size={40}
            />
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
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-background px-2 py-0.5">
              <span className={cn("size-1.5 rounded-full", cfg.dot)} />
              <span className={cn("text-[10px] font-medium", cfg.text)}>{cfg.label}</span>
            </div>
            <ProjectCardOverflowMenu
              projectId={project.id}
              appName={appName}
              previewUrl={project.preview_url}
              publicUrl={publicUrl}
              publishHref={canPublish ? `/projects/${project.id}?tab=publish` : null}
              isFavorite={Boolean(project.is_favorite)}
              onToggleFavorite={(next) => onToggleFavorite(project.id, next)}
              onRenamed={onRefresh}
              onDeleted={onRefresh}
            />
          </div>
        </div>

        <div className="pointer-events-auto relative z-[2] mt-2 flex flex-wrap gap-2">
          <Link
            href={actions.primary.href}
            className="rounded-lg bg-accent/12 px-2.5 py-1 text-[10.5px] font-semibold text-accent ring-1 ring-accent/20 transition hover:bg-accent hover:text-white"
          >
            {actions.primary.label}
          </Link>
          {actions.secondary && (
            <Link
              href={actions.secondary.href}
              className="rounded-lg bg-surface px-2.5 py-1 text-[10.5px] font-medium text-foreground ring-1 ring-border transition hover:ring-accent/25"
            >
              {actions.secondary.label}
            </Link>
          )}
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
        </div>

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {getUserSafeProjectBadges(project, {
              mode: "user",
              lifecycleStatus: project.lifecycle_status,
              lifecycleLabel: project.lifecycle_label,
            })
              .filter((b) => b.kind === "meta")
              .map((b) => (
                <span
                  key={b.label}
                  className="rounded-md bg-accent/8 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/50"
                >
                  {b.label}
                </span>
              ))}
            <span className="truncate">{new Date(project.updated_at).toLocaleDateString()}</span>
          </div>
          <FavoriteStarButton
            active={Boolean(project.is_favorite)}
            onToggle={() => onToggleFavorite(project.id, !project.is_favorite)}
          />
        </div>
      </div>
    </motion.div>
  );
}

const PROJECTS_CACHE_KEY = "dreamos-projects-cache-v1";

export function ProjectsView() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, user, loading: authLoading } = useAuthStore();
  const ownerId = user?.id ?? profile?.id;
  const isAdmin = isDreamosOwnerEmail(user?.email ?? profile?.email);
  const [projects, setProjects] = React.useState<ProjectRow[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(PROJECTS_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ProjectRow[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = React.useState(true);
  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(false);
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const section = searchParams.get("section");
    if (section === "drafts") setStatusFilter("draft");
    else if (section === "building") setStatusFilter("building");
    else if (section === "published") setStatusFilter("published");
    else if (section === "archived") setStatusFilter("archived");
  }, [searchParams]);
  const [sort, setSort] = React.useState<"updated" | "name">("updated");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [showImport, setShowImport] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const lastLoadRef = React.useRef(0);
  const projectsRef = React.useRef(projects);
  projectsRef.current = projects;

  const loadProjects = React.useCallback((reconcile = false) => {
    const now = Date.now();
    const hasCache = projectsRef.current.length > 0;
    if (!reconcile && now - lastLoadRef.current < 60_000 && hasCache) return;
    lastLoadRef.current = now;
    if (!hasCache) setLoading(true);
    setLoadError(null);
    const qs = reconcile ? "?reconcile=1" : "";
    fetch(`/api/projects${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((body: { projects?: ProjectRow[] }) => {
        const list = body.projects ?? [];
        setProjects(list);
        try {
          sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(list));
        } catch {
          /* ignore quota */
        }
        setHasFetchedOnce(true);
        setLoading(false);
      })
      .catch(() => {
        if (!ownerId) {
          setLoadError("Could not load your apps. Try again.");
          setHasFetchedOnce(true);
          setLoading(false);
          return;
        }
        void Promise.resolve(
          supabase
            .from("projects")
            .select("*, app_name, short_description, category, icon_svg, build_status, icon_url, is_favorite")
            .eq("owner_id", ownerId)
            .order("updated_at", { ascending: false }),
        )
          .then(({ data, error }) => {
            if (error) throw error;
            setProjects((data as ProjectRow[]) ?? []);
            setHasFetchedOnce(true);
            setLoading(false);
          })
          .catch(() => {
            setLoadError("Could not load your apps. Try again.");
            setHasFetchedOnce(true);
            setLoading(false);
          });
      });
  }, [ownerId, supabase]);

  const toggleFavorite = React.useCallback(async (projectId: string, next: boolean) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, is_favorite: next } : p)),
    );
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: next }),
      });
      if (!res.ok) throw new Error("favorite_failed");
      const list = projectsRef.current.map((p) =>
        p.id === projectId ? { ...p, is_favorite: next } : p,
      );
      sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(list));
    } catch {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, is_favorite: !next } : p)),
      );
    }
  }, []);

  React.useEffect(() => {
    const main = document.querySelector("main");
    main?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    if (projectsRef.current.length > 0) {
      setLoading(false);
      setHasFetchedOnce(true);
    }
    loadProjects(false);
    const onFocus = () => {
      if (Date.now() - lastLoadRef.current > 180_000) loadProjects(false);
    };
    window.addEventListener("focus", onFocus);
    const onProjectsInvalidate = () => {
      lastLoadRef.current = 0;
      loadProjects(true);
    };
    window.addEventListener("dreamos:projects-invalidate", onProjectsInvalidate);
    const unsubCatalog = subscribeProjectCatalogUpdated(() => {
      lastLoadRef.current = 0;
      loadProjects(true);
    });
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dreamos:projects-invalidate", onProjectsInvalidate);
      unsubCatalog();
    };
  }, [ownerId, authLoading, loadProjects]);

  const showGridSkeleton =
    (authLoading || loading) && projects.length === 0 && !hasFetchedOnce;

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      const name = (p.name ?? "").toLowerCase();
      const appName = ((p as ProjectRow).app_name ?? "").toLowerCase();
      const matchSearch = !q || name.includes(q) || appName.includes(q);
      const ls = p.lifecycle_status ?? readLifecycleFromMetadata(p.metadata).lifecycle_status;
      const bs = String(p.build_status ?? "").toLowerCase();
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      let matchStatus = statusFilter === "all";
      if (!matchStatus) {
        if (statusFilter === "building") {
          matchStatus =
            bs === "running" || bs === "building" || bs === "queued" || ls === "building" || ls === "build_queued";
        } else if (statusFilter === "published") {
          matchStatus = Boolean(p.published_subdomain?.trim()) || ls === "published" || p.status === "live";
        } else if (statusFilter === "archived") {
          matchStatus = meta.visibility_status === "archived" || ls === "archived";
        } else if (statusFilter === "draft") {
          matchStatus =
            ls === "draft" ||
            ls === "intent_review" ||
            meta.visibility_status === "draft" ||
            meta.visibility_status === "draft_pending";
        } else {
          matchStatus = ls === statusFilter || p.status === statusFilter;
        }
      }
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sort === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const showEmpty =
    hasFetchedOnce && !loading && !authLoading && !loadError && filtered.length === 0 && !search && statusFilter === "all";

  const { readyList, draftList } = React.useMemo(() => {
    const ready: ProjectRow[] = [];
    const drafts: ProjectRow[] = [];
    for (const p of filtered) {
      const section =
        p.visibility_section ??
        computeProjectCardUiState({
          id: p.id,
          build_status: p.build_status,
          metadata: p.metadata as Record<string, unknown> | null,
          published_subdomain: p.published_subdomain,
          preview_url: p.preview_url,
        }).visibility_section;
      if (section === "ready" || p.is_favorite) ready.push(p);
      else drafts.push(p);
    }
    return { readyList: ready, draftList: drafts };
  }, [filtered]);

  const gridClass = cn(
    view === "grid"
      ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "space-y-2",
  );

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
          <option value="all">All apps</option>
          <option value="draft">Drafts</option>
          <option value="building">Building</option>
          <option value="generated">Generated</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
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
      {showGridSkeleton ? (
        <div className={cn(
          view === "grid"
            ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "space-y-2",
        )}>
          {Array.from({ length: view === "grid" ? 6 : 4 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : loadError ? (
        <motion.div variants={variants.fadeUp} className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
          <p className="text-[14px] text-destructive">{loadError}</p>
          <button
            type="button"
            onClick={() => loadProjects(true)}
            className="mt-3 text-[13px] font-medium text-accent underline"
          >
            Retry
          </button>
        </motion.div>
      ) : showEmpty ? (
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
                Describe what you want in plain English. Vodex generates routes, UI, database schema, auth, and APIs.
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
      ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="size-8 text-muted-foreground/30" strokeWidth={1.25} />}
            title="No matching projects"
            description="Try a different search term or clear the filter."
          />
      ) : (
        <div className="space-y-8" data-testid="apps-sectioned-list">
          {readyList.length > 0 ? (
            <section data-testid="apps-ready-section">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Ready apps
              </h2>
              <div className={gridClass}>
                {readyList.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onToggleFavorite={toggleFavorite}
                    onRefresh={() => loadProjects(true)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {draftList.length > 0 ? (
            <section data-testid="apps-drafts-section">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Drafts
              </h2>
              <div className={gridClass}>
                {draftList.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onToggleFavorite={toggleFavorite}
                    onRefresh={() => loadProjects(true)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
