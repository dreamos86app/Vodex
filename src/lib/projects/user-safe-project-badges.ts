import {
  LIFECYCLE_META,
  readLifecycleFromMetadata,
  type ProjectLifecycleStatus,
  isLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import {
  isZipImportProject,
  readImportMeta,
  resolveImportedLifecycleStatus,
} from "@/lib/projects/imported-project-state";

export type BadgeTone = "default" | "positive" | "warning" | "destructive" | "accent" | "building";

export type UserSafeBadge = {
  label: string;
  tone: BadgeTone;
  kind: "status" | "meta";
};

export type UserSafeProjectBadgesOptions = {
  /** `user` hides tech metadata; `admin` may include framework/file counts. Default: user */
  mode?: "user" | "admin";
  fileCount?: number;
  lifecycleStatus?: string | null;
  lifecycleLabel?: string | null;
};

export type ProjectCardInput = {
  id: string;
  status?: string;
  framework?: string | null;
  preview_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProjectCardAction = {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

const TONE_MAP: Record<BadgeTone, { dot: string; text: string }> = {
  default: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  positive: { dot: "bg-positive", text: "text-positive" },
  warning: { dot: "bg-amber-400", text: "text-amber-400" },
  destructive: { dot: "bg-destructive", text: "text-destructive" },
  accent: { dot: "bg-accent animate-pulse", text: "text-accent" },
  building: { dot: "bg-accent animate-pulse", text: "text-accent" },
};

export function badgeToneClasses(tone: BadgeTone): { dot: string; text: string } {
  return TONE_MAP[tone] ?? TONE_MAP.default;
}

function resolveLifecycle(project: ProjectCardInput, options: UserSafeProjectBadgesOptions): ProjectLifecycleStatus | null {
  const meta = project.metadata ?? {};
  const fromRow = options.lifecycleStatus ?? null;
  if (fromRow && isLifecycleStatus(fromRow)) return fromRow;
  const fromMeta = readLifecycleFromMetadata(meta).lifecycle_status;
  return fromMeta ?? null;
}

function importedUserStatus(
  metadata: Record<string, unknown>,
  fileCount: number,
): { label: string; tone: BadgeTone } {
  const imp = readImportMeta(metadata);
  const st = resolveImportedLifecycleStatus(metadata, imp.file_count ?? fileCount, false);
  switch (st) {
    case "imported_needs_setup":
      return { label: "Needs setup", tone: "warning" };
    case "imported_preview_ready":
      return { label: "Ready", tone: "positive" };
    case "imported_error":
      return { label: "Needs setup", tone: "destructive" };
    case "importing":
      return { label: "Building", tone: "building" };
    default:
      return { label: "Imported app", tone: "default" };
  }
}

function lifecycleUserStatus(
  lifecycle: ProjectLifecycleStatus,
  lifecycleLabel?: string | null,
): { label: string; tone: BadgeTone } {
  const meta = LIFECYCLE_META[lifecycle];
  const label =
    lifecycle === "draft"
      ? "Draft idea"
      : lifecycle === "blueprint_ready"
        ? "Plan ready"
        : lifecycle === "building" || lifecycle === "build_queued" || lifecycle === "blueprint_generating"
          ? "Building"
          : lifecycle === "generated" || lifecycle === "preview_ready" || lifecycle === "publish_ready"
            ? "Ready"
            : lifecycle === "published"
              ? "Published"
              : lifecycle === "needs_attention" || lifecycle === "failed"
                ? "Needs setup"
                : lifecycleLabel ?? meta.userLabel;

  const tone: BadgeTone =
    lifecycle === "published" || lifecycle === "generated" || lifecycle === "preview_ready"
      ? "positive"
      : lifecycle === "building" || lifecycle === "build_queued" || lifecycle === "blueprint_generating"
        ? "building"
        : lifecycle === "failed" || lifecycle === "needs_attention"
          ? "destructive"
          : lifecycle === "blueprint_ready"
            ? "accent"
            : lifecycle === "imported_needs_setup"
              ? "warning"
              : "default";

  return { label, tone };
}

/** User-safe badges for project cards — no framework/file/route metadata in user mode. */
export function getUserSafeProjectBadges(
  project: ProjectCardInput,
  options: UserSafeProjectBadgesOptions = {},
): UserSafeBadge[] {
  const mode = options.mode ?? "user";
  const meta = (project.metadata ?? {}) as Record<string, unknown>;
  const fileCount = options.fileCount ?? 0;
  const badges: UserSafeBadge[] = [];

  if (isZipImportProject(meta)) {
    const st = importedUserStatus(meta, fileCount);
    badges.push({ label: st.label, tone: st.tone, kind: "status" });
    if (mode === "user") {
      if (st.label !== "Imported app" && st.label !== "Ready") {
        badges.push({ label: "Imported app", tone: "default", kind: "meta" });
      }
    } else {
      badges.push({ label: "Imported app", tone: "default", kind: "meta" });
      const imp = readImportMeta(meta);
      if (imp.file_count) badges.push({ label: `${imp.file_count.toLocaleString()} files`, tone: "default", kind: "meta" });
      const fw = imp.framework?.id ?? project.framework;
      if (fw && fw !== "unknown") badges.push({ label: String(fw), tone: "default", kind: "meta" });
    }
    return badges;
  }

  const buildStatus = String(meta.build_status ?? project.status ?? "").toLowerCase();
  const previewState = String(meta.preview_state ?? "").toLowerCase();
  const previewReady = meta.preview_ready === true && meta.preview_honest !== false;

  if (buildStatus === "building" || buildStatus === "planning") {
    badges.push({ label: "Building", tone: "building", kind: "status" });
  } else if (
    buildStatus === "preview_failed" ||
    previewState === "failed" ||
    buildStatus === "failed"
  ) {
    badges.push({ label: "Preview failed", tone: "destructive", kind: "status" });
  } else if (
    (buildStatus === "files_saved" ||
      buildStatus === "preview_pending" ||
      previewState === "warming" ||
      previewState === "pending" ||
      previewState === "timeout") &&
    !previewReady
  ) {
    badges.push({ label: "Preview preparing", tone: "warning", kind: "status" });
  } else {
    const lifecycle = resolveLifecycle(project, options);
    if (lifecycle) {
      const st = lifecycleUserStatus(lifecycle, options.lifecycleLabel);
      if (lifecycle === "generated" || lifecycle === "preview_ready") {
        badges.push({
          label: previewReady ? st.label : "Preview preparing",
          tone: previewReady ? st.tone : "warning",
          kind: "status",
        });
      } else {
        badges.push({ label: st.label, tone: st.tone, kind: "status" });
      }
    } else if (previewReady || buildStatus === "ready" || buildStatus === "completed") {
      badges.push({ label: "Ready", tone: "positive", kind: "status" });
    } else {
      badges.push({ label: "Draft idea", tone: "default", kind: "status" });
    }
  }

  if (mode === "admin") {
    if (project.framework && project.framework !== "unknown") {
      badges.push({ label: project.framework, tone: "default", kind: "meta" });
    }
    if (fileCount > 0) {
      badges.push({ label: `${fileCount.toLocaleString()} files`, tone: "default", kind: "meta" });
    }
  }

  return badges;
}

/** Primary status badge (first badge) with tone classes for card header. */
export function getProjectCardStatus(project: ProjectCardInput, options?: UserSafeProjectBadgesOptions) {
  const badges = getUserSafeProjectBadges(project, options);
  const primary = badges.find((b) => b.kind === "status") ?? badges[0];
  const classes = badgeToneClasses(primary.tone);
  return { label: primary.label, ...classes };
}

/** Lifecycle-aware CTAs for project cards. */
export function getProjectCardActions(project: ProjectCardInput, options?: UserSafeProjectBadgesOptions): ProjectCardAction {
  const meta = (project.metadata ?? {}) as Record<string, unknown>;
  const lifecycle = resolveLifecycle(project, options ?? {});

  if (isZipImportProject(meta)) {
    const imp = readImportMeta(meta);
    const st = resolveImportedLifecycleStatus(meta, imp.file_count ?? 0, false);
    if (st === "imported_needs_setup" || st === "imported_error") {
      return {
        primary: { label: "Continue setup", href: `/apps/${project.id}/dashboard?tab=setup` },
        secondary: { label: "Open builder", href: `/apps/${project.id}/builder` },
      };
    }
    return {
      primary: { label: "Open builder", href: `/apps/${project.id}/builder` },
      secondary: { label: "Dashboard", href: `/apps/${project.id}/dashboard` },
    };
  }

  if (lifecycle === "blueprint_ready") {
    return {
      primary: { label: "Review plan", href: `/apps/${project.id}/builder?review=plan` },
      secondary: { label: "Open builder", href: `/apps/${project.id}/builder` },
    };
  }

  if (lifecycle === "published" || lifecycle === "preview_ready" || lifecycle === "publish_ready" || lifecycle === "generated") {
    return {
      primary: { label: "Open builder", href: `/apps/${project.id}/builder` },
      secondary: { label: "Dashboard", href: `/apps/${project.id}/dashboard` },
    };
  }

  if (lifecycle === "imported_needs_setup" || lifecycle === "needs_attention" || lifecycle === "failed") {
    return {
      primary: { label: "Continue setup", href: `/apps/${project.id}/dashboard` },
      secondary: { label: "Open builder", href: `/apps/${project.id}/builder` },
    };
  }

  return {
    primary: { label: "Open builder", href: `/apps/${project.id}/builder` },
    secondary: lifecycle === "draft" ? undefined : { label: "Dashboard", href: `/apps/${project.id}/dashboard` },
  };
}

export function isImportedAppWithoutPreview(project: ProjectCardInput): boolean {
  const meta = (project.metadata ?? {}) as Record<string, unknown>;
  if (!isZipImportProject(meta)) return false;
  if (project.preview_url) return false;
  const imp = readImportMeta(meta);
  const st = resolveImportedLifecycleStatus(meta, imp.file_count ?? 0, false);
  return st === "imported_needs_setup" || st === "imported" || st === "imported_error";
}
