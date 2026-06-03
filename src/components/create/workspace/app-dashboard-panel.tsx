"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Layers,
  LayoutGrid,
  Database,
  Plug,
  Globe,
  Shield,
  ScrollText,
  KeyRound,
  Rocket,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  ChevronDown,
  Mail,
  Users,
  Coins,
  BarChart3,
  Megaphone,
  Workflow,
  Settings,
  Code2,
  Lock,
  Monitor,
  Wrench,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { MobileWrapperStudio } from "@/components/mobile/mobile-wrapper-studio";
import { AppSecretsIntegrationsPanel } from "@/components/integrations/app-secrets-integrations-panel";
import { ProjectPaymentsPanel } from "@/components/payments/project-payments-panel";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { ProjectIntegrationsPanel } from "@/components/integrations/project-integrations-panel";
import { RepairCenter } from "@/components/repair/repair-center";
import { AppSettingsInlineForm } from "@/components/create/workspace/app-settings-inline-form";
import { PublishStatusPanel } from "@/components/publish/publish-status-panel";
import { ImportedSecretsSetupPanel } from "@/components/import/imported-secrets-setup-panel";
import { loadProjectFilePaths } from "@/lib/projects/load-project-files";
import { isZipImportProject } from "@/lib/projects/imported-project-state";
import {
  LIFECYCLE_META,
  normalizeProjectStatus,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import {
  computeProjectCardStatus,
  projectCardStatusCtas,
  projectCardStatusDisplay,
  type ProjectCardStatus,
} from "@/lib/projects/project-card-status";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCreditsStore } from "@/lib/stores/credits-store";
import {
  getDashboardSectionAccess,
  isProjectPublished,
  type DashboardSectionId,
} from "@/lib/dashboard/section-access";

type ProjectRow = Pick<
  Tables<"projects">,
  | "id"
  | "name"
  | "status"
  | "preview_url"
  | "custom_domain"
  | "framework"
  | "gradient"
  | "metadata"
  | "is_public"
> & {
  icon_url?: string | null;
  app_name?: string | null;
  short_description?: string | null;
  category?: string | null;
  icon_svg?: string | null;
  build_status?: string | null;
  published_subdomain?: string | null;
};

export type DashSection = DashboardSectionId;

const MAIN_NAV: Array<{ id: DashSection; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "mobile", label: "Mobile App", icon: Smartphone },
  { id: "publish", label: "Publish", icon: Rocket },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "secrets", label: "Secrets", icon: KeyRound },
  { id: "users", label: "Users", icon: Users },
  { id: "data", label: "Data", icon: Database },
  { id: "analytics", label: "Insights", icon: BarChart3 },
  { id: "marketing", label: "Growth", icon: Megaphone },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "security", label: "Security", icon: Shield },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "logs", label: "Activity", icon: ScrollText },
  { id: "api", label: "API", icon: Code2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const ADVANCED_TECH: Array<{ id: string; label: string; icon: React.ElementType }> = [
  { id: "tech_routes", label: "Routes", icon: Monitor },
  { id: "tech_schema", label: "Schema", icon: Database },
  { id: "tech_build", label: "Build diagnostics", icon: Wrench },
];

type ContactRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/90 ring-1 ring-border/80 shadow-sm dark:bg-background/80">
      <div className="border-b border-border/60 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  ok,
  icon: Icon,
}: {
  label: string;
  value: string;
  ok?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-border/70 dark:bg-background/80">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={cn("size-3.5", ok === true && "text-emerald-600", ok === false && "text-amber-600")} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 truncate text-[13px] font-semibold capitalize text-foreground">{value}</p>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-[12px] leading-relaxed text-muted-foreground">{text}</p>;
}

function DashboardLockedState({
  kind,
  onPublish,
  onContinueBuilding,
  projectId,
}: {
  kind: "locked_publish_required" | "locked_plan_required" | "locked_setup_required";
  onPublish?: () => void;
  onContinueBuilding?: () => void;
  projectId: string;
}) {
  const title =
    kind === "locked_publish_required"
      ? "Publish your app first"
      : kind === "locked_plan_required"
        ? "Upgrade to unlock"
        : "Setup required";

  const body =
    kind === "locked_publish_required"
      ? "These tools become available after your app is live."
      : kind === "locked_plan_required"
        ? "This section is included on paid plans."
        : "Complete a few setup steps to use this section.";

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      data-testid="dashboard-locked-state"
      data-lock-kind={kind}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border">
        <Lock className="size-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="max-w-sm space-y-2">
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {kind === "locked_publish_required" && onPublish ? (
          <button
            type="button"
            onClick={onPublish}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-emerald-600/90"
          >
            <Rocket className="size-3.5" />
            Publish app
          </button>
        ) : null}
        {onContinueBuilding ? (
          <Link
            href={`/apps/${projectId}/builder`}
            onClick={onContinueBuilding}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-[12px] font-semibold text-foreground ring-1 ring-border hover:bg-surface-raised"
          >
            Continue building
          </Link>
        ) : (
          <Link
            href={`/apps/${projectId}/builder`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-[12px] font-semibold text-foreground ring-1 ring-border"
          >
            Continue building
          </Link>
        )}
      </div>
    </div>
  );
}

export function AppDashboardPanel({
  project,
  isBusy,
  refreshKey = 0,
  activeSection,
  onSectionChange,
  onOpenPublish,
  planId = "free",
}: {
  project: ProjectRow | null;
  isBusy: boolean;
  refreshKey?: number;
  activeSection?: DashSection;
  onSectionChange?: (section: DashSection) => void;
  onOpenPublish?: () => void;
  planId?: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const actionCredits = useCreditsStore((s) => s.action);
  const [internalSection, setInternalSection] = React.useState<DashSection>("overview");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [advancedTech, setAdvancedTech] = React.useState("tech_routes");
  const section = activeSection ?? internalSection;
  const setSection = (s: DashSection) => {
    if (onSectionChange) onSectionChange(s);
    else setInternalSection(s);
  };

  const [contactRequests, setContactRequests] = React.useState<ContactRow[]>([]);
  const [contactsLoading, setContactsLoading] = React.useState(false);
  const [filePaths, setFilePaths] = React.useState<string[]>([]);
  const [buildStatus, setBuildStatus] = React.useState<string | null>(null);
  const [buildAt, setBuildAt] = React.useState<string | null>(null);
  const [fileCount, setFileCount] = React.useState(0);
  const [cardStatus, setCardStatus] = React.useState<ProjectCardStatus | null>(null);
  const [publishReady, setPublishReady] = React.useState(false);
  const { user, profile } = useAuthStore();
  const isAdmin = isDreamosOwnerEmail(user?.email ?? profile?.email);
  const [publishBlockers, setPublishBlockers] = React.useState<string[]>([]);
  const [previewErrors, setPreviewErrors] = React.useState<
    Array<{ message: string; file?: string; line?: number }>
  >([]);
  const [secretKeys, setSecretKeys] = React.useState<Array<{ name: string; updated_at: string }>>([]);
  const [secretsLoading, setSecretsLoading] = React.useState(false);
  const [settingsRefresh, setSettingsRefresh] = React.useState(0);
  const combinedRefreshKey = refreshKey + settingsRefresh;
  const readinessFetchedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (activeSection) setInternalSection(activeSection);
  }, [activeSection]);

  React.useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    void Promise.all([
      loadProjectFilePaths(supabase, project.id),
      supabase
        .from("build_jobs")
        .select("status, created_at, completed_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(async ([pathsRes, buildRes]) => {
      if (cancelled) return;
      if (!pathsRes.error) {
        setFilePaths(pathsRes.paths);
        setFileCount(pathsRes.paths.length);
      }
      if (!buildRes.error && buildRes.data) {
        setBuildStatus(buildRes.data.status);
        setBuildAt(
          (buildRes.data as { completed_at?: string }).completed_at ?? buildRes.data.created_at,
        );
      }
      const rk = `${project.id}:${combinedRefreshKey}`;
      if (readinessFetchedRef.current === rk) return;
      readinessFetchedRef.current = rk;
      const [readyJson, errJson, buildStatusJson] = await Promise.all([
        fetch(`/api/projects/${project.id}/publish/readiness`, { credentials: "include" }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`/api/projects/${project.id}/preview-errors`, { credentials: "include" }).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`/api/projects/${project.id}/build-status`, { credentials: "include" }).then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);
      if (cancelled) return;
      const bs = buildStatusJson as { card_status?: ProjectCardStatus } | null;
      if (bs?.card_status) setCardStatus(bs.card_status);
      const ready = readyJson as { canPublish?: boolean; canPublishWeb?: boolean; blockers?: string[] } | null;
      setPublishReady(Boolean(ready?.canPublish ?? ready?.canPublishWeb));
      setPublishBlockers(ready?.blockers ?? []);
      const errs = errJson as { errors?: Array<{ message: string; file?: string; line?: number }> };
      setPreviewErrors(errs?.errors ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [project?.id, supabase, combinedRefreshKey]);

  React.useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    setContactsLoading(true);
    void fetch(`/api/projects/${project.id}/contacts`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { requests?: ContactRow[] } | null) => {
        if (!cancelled) setContactRequests(json?.requests ?? []);
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, combinedRefreshKey]);

  React.useEffect(() => {
    if (!project?.id || section !== "secrets") return;
    let cancelled = false;
    setSecretsLoading(true);
    void fetch(`/api/projects/${project.id}/secrets`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { keys?: Array<{ name: string; updated_at: string }> } | null) => {
        if (!cancelled) setSecretKeys(json?.keys ?? []);
      })
      .finally(() => {
        if (!cancelled) setSecretsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, section, combinedRefreshKey]);

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
          <Layers className="size-6 text-accent" strokeWidth={1.5} />
        </div>
        <p className="text-[14px] font-semibold text-foreground">No saved app yet</p>
        <EmptyHint text="Open an app from Your Apps — or import a ZIP to get started." />
        <Link href="/projects" className="text-[12px] font-semibold text-accent hover:underline">
          View your apps
        </Link>
      </div>
    );
  }

  const dashProject = project;
  const projectId = dashProject.id;
  const meta =
    dashProject.metadata && typeof dashProject.metadata === "object" && !Array.isArray(dashProject.metadata)
      ? (dashProject.metadata as Record<string, unknown>)
      : {};
  const builder =
    meta.builder && typeof meta.builder === "object" && !Array.isArray(meta.builder)
      ? (meta.builder as Record<string, unknown>)
      : null;
  const pages = Array.isArray(builder?.pages)
    ? (builder.pages as Array<string | { name?: string; route?: string }>)
    : [];
  const entities = Array.isArray(builder?.entities)
    ? (builder.entities as Array<string | { name?: string }>)
    : [];
  const isZipImport = isZipImportProject(meta);
  const importMeta = (meta.import ?? {}) as { env_requirements?: unknown; file_count?: number };
  const hasFiles = fileCount > 0;
  const blueprintApproved = Boolean(meta.blueprint_approved_at || meta.approved_blueprint);
  const normalizedLifecycle = normalizeProjectStatus({
    lifecycleStatus: typeof meta.lifecycle_status === "string" ? meta.lifecycle_status : null,
    buildStatus: dashProject.build_status,
    fileCount,
    hasActiveBuildJob: isBusy,
    buildJobStatus: buildStatus,
    publishedSubdomain: dashProject.published_subdomain,
    previewUrl: dashProject.preview_url,
    blueprintApproved,
    hasBlueprint: Boolean(meta.blueprint || meta.approved_blueprint),
  }) as ProjectLifecycleStatus;
  const published = isProjectPublished(dashProject);
  const buildOk =
    hasFiles &&
    (buildStatus === "completed" ||
      buildStatus === "succeeded" ||
      dashProject.status === "live" ||
      dashProject.build_status === "imported" ||
      (isZipImport && fileCount > 0));
  const effectiveCardStatus =
    cardStatus ??
    computeProjectCardStatus({
      build_status: dashProject.build_status,
      metadata: meta,
    });
  const cardDisplay = projectCardStatusDisplay(effectiveCardStatus);
  const statusCtas = projectCardStatusCtas(projectId, effectiveCardStatus, { isAdmin });
  const previewReady = effectiveCardStatus === "ready";
  const importedReady = isZipImport && (hasFiles || (importMeta.file_count ?? 0) > 0);
  const buildDidNotComplete =
    !hasFiles &&
    !importedReady &&
    (buildStatus === "completed" ||
      buildStatus === "succeeded" ||
      normalizedLifecycle === "failed" ||
      normalizedLifecycle === "needs_attention");
  const canPublish = publishReady;
  const displayName = (dashProject as ProjectRow).app_name?.trim() || dashProject.name || "App";
  const displayDesc =
    (dashProject as ProjectRow).short_description?.trim() ||
    (typeof meta.short_description === "string" ? meta.short_description : null);
  const iconSrc =
    (dashProject as ProjectRow).icon_svg?.startsWith("data:")
      ? (dashProject as ProjectRow).icon_svg!
      : dashProject.icon_url ?? `/api/projects/${projectId}/icon`;

  const checklist = [
    { label: "App details ready", done: Boolean(displayName && displayDesc) },
    { label: "App experience ready", done: previewReady || buildOk },
    { label: "Domain connected", done: Boolean(dashProject.published_subdomain || dashProject.custom_domain) },
    { label: "Contact email configured", done: false },
    { label: "Action credits enabled", done: (actionCredits?.available ?? 0) > 0 },
    { label: "Publish ready", done: publishReady },
  ];

  const sectionAccess = getDashboardSectionAccess(dashProject, section, planId);

  const overviewContent = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-white/95 px-4 py-4 shadow-sm ring-1 ring-accent/10 dark:bg-background/90">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border">
          <Image src={iconSrc} alt="" width={56} height={56} className="size-full object-cover" unoptimized />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[16px] font-semibold text-foreground">{displayName}</p>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                normalizedLifecycle === "published"
                  ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25"
                  : isBusy
                    ? "bg-accent/10 text-accent ring-accent/25"
                    : "bg-muted text-muted-foreground ring-border",
              )}
            >
              {isBusy && effectiveCardStatus === "building" ? "Building" : cardDisplay.label}
            </span>
          </div>
          {displayDesc ? (
            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{displayDesc}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/apps/${projectId}/builder`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-accent/90"
        >
          <Play className="size-3.5" />
          Continue building
        </Link>
        {canPublish ? (
          <button
            type="button"
            onClick={onOpenPublish}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-emerald-600/90"
          >
            <Rocket className="size-3.5" />
            Publish app
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3.5 py-2 text-[12px] font-medium text-muted-foreground">
            <Rocket className="size-3.5 opacity-50" />
            Publish app
          </span>
        )}
        <Link
          href={`/apps/${project.id}/builder?tab=build`}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-accent hover:underline"
        >
          Edit details
        </Link>
      </div>

      {importedReady && (
        <div className="rounded-xl bg-emerald-500/5 px-4 py-3 ring-1 ring-emerald-500/20">
          <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-200">Imported app ready</p>
          <EmptyHint text="Your ZIP files are loaded. Review setup in Code and Preview, then publish when ready." />
          <Link
            href={`/apps/${projectId}/builder?tab=code`}
            className="mt-2 inline-flex rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            Review imported app
          </Link>
        </div>
      )}

      {(buildDidNotComplete || effectiveCardStatus === "failed") && (
        <div className="rounded-xl bg-destructive/5 px-4 py-3 ring-1 ring-destructive/20">
          <p className="text-[13px] font-semibold text-destructive">Build did not complete</p>
          <EmptyHint text="No app files were generated. Return to Build and try again." />
          <Link
            href={`/apps/${projectId}/builder?retry=1`}
            className="mt-2 inline-flex rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            Retry build
          </Link>
        </div>
      )}

      {effectiveCardStatus === "preview_failed" && (
        <div className="rounded-xl bg-destructive/5 px-4 py-3 ring-1 ring-destructive/20">
          <p className="text-[13px] font-semibold text-destructive">Preview failed</p>
          <EmptyHint text="Your files were saved but the live preview could not start. Try a repair pass." />
          <div className="mt-2 flex flex-wrap gap-2">
            {statusCtas.map((cta) => (
              <Link
                key={cta.href}
                href={cta.href}
                className="inline-flex rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                {cta.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label="Build"
          value={
            isBusy || effectiveCardStatus === "building"
              ? "Building"
              : effectiveCardStatus === "failed"
                ? "Failed"
                : importedReady
                  ? "Imported"
                  : buildDidNotComplete
                    ? "Incomplete"
                    : hasFiles
                      ? cardDisplay.label
                      : "Not started"
          }
          ok={buildOk && effectiveCardStatus !== "failed"}
          icon={buildOk ? CheckCircle2 : isBusy ? Loader2 : Clock}
        />
        <StatCard
          label="Experience"
          value={
            effectiveCardStatus === "ready"
              ? "Ready"
              : effectiveCardStatus === "preview_preparing"
                ? "Preparing preview"
                : effectiveCardStatus === "preview_failed"
                  ? "Preview failed"
                  : hasFiles
                    ? "Available"
                    : "Pending"
          }
          ok={previewReady}
          icon={previewReady ? CheckCircle2 : AlertCircle}
        />
        <StatCard
          label="Publishing"
          value={publishReady ? "Ready" : "Not yet"}
          ok={publishReady}
          icon={publishReady ? Rocket : AlertCircle}
        />
        <StatCard
          label="Action Credits"
          value={actionCredits ? `${Math.max(0, actionCredits.available).toFixed(0)} left` : "—"}
          icon={Coins}
        />
        <StatCard
          label="Last updated"
          value={buildAt ? new Date(buildAt).toLocaleDateString() : "—"}
          icon={Clock}
        />
      </div>

      <SectionCard title="Launch checklist">
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-[12px]">
              {item.done ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
              ) : (
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="App users">
        {!published ? (
          <EmptyHint text="Publish your app first to see user activity here." />
        ) : (
          <EmptyHint text="No users yet. Share your app link to get your first signups." />
        )}
      </SectionCard>

      <SectionCard title="Contact inbox">
        {!published ? (
          <EmptyHint text="Publish your app first to receive contact submissions." />
        ) : contactsLoading ? (
          <EmptyHint text="Loading messages…" />
        ) : contactRequests.length === 0 ? (
          <EmptyHint text="Contact form submissions from your app will appear here." />
        ) : (
          <ul className="space-y-2">
            {contactRequests.slice(0, 6).map((c) => (
              <li key={c.id} className="rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/60">
                <p className="text-[12px] font-semibold text-foreground">{c.name?.trim() || "Visitor"}</p>
                {c.message ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-foreground">{c.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );

  function renderSectionBody() {
    if (section !== "overview" && sectionAccess !== "unlocked") {
      return (
        <DashboardLockedState
          kind={sectionAccess}
          projectId={projectId}
          onPublish={onOpenPublish}
        />
      );
    }

    switch (section) {
      case "overview":
        return overviewContent;
      case "users":
        return (
          <SectionCard title="App users">
            <EmptyHint text="Manage signups, invites, and access from here once people start using your app." />
          </SectionCard>
        );
      case "data":
        return (
          <SectionCard title="App data">
            <EmptyHint text="Your app collections and saved information will show up here in plain language." />
          </SectionCard>
        );
      case "analytics":
        return (
          <SectionCard title="Analytics">
            <EmptyHint text="Visits, signups, and engagement metrics appear here after your app goes live." />
          </SectionCard>
        );
      case "marketing":
        return (
          <SectionCard title="Marketing">
            <EmptyHint text="Share links, social previews, and referral tools live here." />
          </SectionCard>
        );
      case "domains":
        return (
          <SectionCard title="Domains">
            {dashProject.published_subdomain ? (
              <p className="text-[12px] text-foreground">
                Live address: <span className="font-medium">{dashProject.published_subdomain}</span>
              </p>
            ) : (
              <EmptyHint text="Connect a custom web address after you publish." />
            )}
          </SectionCard>
        );
      case "integrations":
        return <ProjectIntegrationsPanel projectId={projectId} planId={planId} />;
      case "payments":
        return <ProjectPaymentsPanel projectId={projectId} planId={planId} published={published} />;
      case "security":
        return (
          <SectionCard title="Security">
            <EmptyHint text="Sign-in, access rules, and privacy settings for your live app." />
          </SectionCard>
        );
      case "automations":
        return (
          <SectionCard title="Automations">
            <EmptyHint text="Automate follow-ups, notifications, and workflows for your app." />
          </SectionCard>
        );
      case "logs":
        return (
          <SectionCard title="Activity">
            <EmptyHint text="Recent activity and errors from your live app — friendly summaries only." />
          </SectionCard>
        );
      case "api":
        return (
          <SectionCard title="API access">
            <EmptyHint text="Programmatic access for developers. Keys are never shown in plain text here." />
          </SectionCard>
        );
      case "settings":
        return (
          <div className="space-y-4">
            <SectionCard title="App settings">
              <AppSettingsInlineForm
                projectId={projectId}
                initialName={displayName}
                initialDescription={displayDesc ?? ""}
                initialPublic={Boolean(dashProject.is_public)}
                iconSrc={iconSrc}
                onSaved={() => setSettingsRefresh((k) => k + 1)}
              />
            </SectionCard>
            <div className="rounded-2xl border border-border/70 bg-white/80 ring-1 ring-border/50 dark:bg-background/80">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                data-testid="developer-diagnostics-toggle"
              >
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Developer diagnostics</p>
                  <p className="text-[11px] text-muted-foreground">Routes, schema, and build checks — for advanced setup</p>
                </div>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition", advancedOpen && "rotate-180")}
                />
              </button>
              {advancedOpen ? (
                <div className="border-t border-border/60 px-3 pb-4" data-testid="developer-diagnostics">
                  <div className="mb-3 flex gap-1 overflow-x-auto pt-3">
                    {ADVANCED_TECH.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setAdvancedTech(s.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition",
                          advancedTech === s.id
                            ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                            : "text-muted-foreground hover:bg-surface",
                        )}
                      >
                        <s.icon className="size-3" strokeWidth={1.75} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {advancedContent}
                </div>
              ) : null}
            </div>
          </div>
        );
      case "mobile":
        return (
          <SectionCard title="Mobile App (Capacitor)">
            <p className="mb-3 text-[12px] text-muted-foreground">
              Capacitor is free. Prepare a wrapper package for Android Studio or Xcode when your web build is ready.
            </p>
            <MobileWrapperStudio
              projectId={projectId}
              projectName={displayName}
              planId={planId ?? "free"}
              fileCount={fileCount}
              hasPreview={previewReady || hasFiles}
              iconUrl={dashProject.icon_url ?? undefined}
              onAskForHelp={() => {
                window.location.href = `/apps/${projectId}/builder`;
              }}
            />
          </SectionCard>
        );
      case "publish":
        return (
          <div className="space-y-3">
            <PublishStatusPanel
              projectId={projectId}
              status={canPublish ? "ready" : publishBlockers.length > 0 ? "blocked" : "draft"}
              readinessBlockers={publishBlockers}
            />
            {canPublish ? (
              <button
                type="button"
                onClick={onOpenPublish}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[13px] font-semibold text-white"
                data-testid="dashboard-publish-cta"
              >
                <Rocket className="size-4" />
                Publish app
              </button>
            ) : null}
          </div>
        );
      case "secrets":
        return (
          <SectionCard title="Secrets & Integrations">
            <AppSecretsIntegrationsPanel
              projectId={projectId}
              appPrompt={typeof meta.template_prompt === "string" ? meta.template_prompt : displayDesc ?? ""}
            />
            {isZipImport ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <ImportedSecretsSetupPanel
                  projectId={projectId}
                  envRequirements={importMeta.env_requirements ?? meta.env_requirements}
                  onSaved={() => {
                    readinessFetchedRef.current = null;
                  }}
                />
              </div>
            ) : null}
          </SectionCard>
        );
      default:
        return overviewContent;
    }
  }

  const pageRoutes = filePaths.filter(
    (p) => /\/(page|pages)\//i.test(p) || /page\.(tsx|jsx|html)$/i.test(p),
  );

  const advancedContent = (() => {
    switch (advancedTech) {
      case "tech_routes":
        return (
          <SectionCard title="Detected routes">
            {pages.length > 0 ? (
              <ul className="space-y-1.5">
                {pages.map((p, i) => (
                  <li key={i} className="rounded-lg bg-background/80 px-2.5 py-1.5 font-mono text-[11px] ring-1 ring-border/60">
                    {typeof p === "string" ? p : `${p.name ?? "Screen"}${p.route ? ` · ${p.route}` : ""}`}
                  </li>
                ))}
              </ul>
            ) : pageRoutes.length > 0 ? (
              <ul className="space-y-1 font-mono text-[11px]">
                {pageRoutes.slice(0, 24).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              <EmptyHint text="No routes detected yet." />
            )}
          </SectionCard>
        );
      case "tech_schema":
        return (
          <SectionCard title="Data schema">
            {entities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {entities.map((e, i) => (
                  <span key={i} className="rounded-md bg-accent/10 px-2 py-1 font-mono text-[11px] text-accent ring-1 ring-accent/20">
                    {typeof e === "string" ? e : (e.name ?? "Entity")}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyHint text="Schema metadata appears after generation." />
            )}
          </SectionCard>
        );
      case "tech_build":
        return (
          <SectionCard title="Build diagnostics">
            {previewErrors.length > 0 ? (
              <ul className="space-y-2">
                {previewErrors.map((e, i) => (
                  <li key={i} className="rounded-lg bg-destructive/5 px-2.5 py-2 text-[11px] ring-1 ring-destructive/20">
                    <p className="font-medium text-destructive">{e.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text="No diagnostics recorded." />
            )}
            <div className="mt-3">
              <RepairCenter projectId={projectId} compact />
            </div>
            {publishBlockers.length > 0 ? (
              <div className="mt-3">
                <PublishStatusPanel projectId={projectId} status="blocked" readinessBlockers={publishBlockers} />
              </div>
            ) : null}
          </SectionCard>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex h-full min-h-0 bg-gradient-to-b from-[#f6f9ff] to-background" data-testid="app-dashboard-panel">
      <nav
        className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-border/60 bg-background/80 p-2 lg:flex"
        data-testid="dashboard-internal-nav"
      >
        {MAIN_NAV.map((s) => {
          const Icon = s.icon;
          const access = getDashboardSectionAccess(dashProject, s.id, planId);
          const locked = access !== "unlocked" && s.id !== "overview";
          return (
            <button
              key={s.id}
              type="button"
              data-dashboard-section={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium transition",
                section === s.id
                  ? "bg-accent/10 text-accent ring-1 ring-accent/20"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.65} />
              <span className="truncate">{s.label}</span>
              {locked ? <Lock className="ml-auto size-3 opacity-50" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur-sm lg:hidden">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as DashSection)}
            className="h-9 w-full rounded-lg bg-surface px-2 text-[12px] ring-1 ring-border"
            aria-label="Dashboard section"
          >
            {MAIN_NAV.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderSectionBody()}</div>
      </div>
    </div>
  );
}
