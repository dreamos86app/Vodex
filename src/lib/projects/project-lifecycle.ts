/**
 * Canonical app lifecycle — stored in projects.metadata.lifecycle_status
 * Legacy projects.status (live|draft|building|…) is derived for UI compat.
 */

export type ProjectLifecycleStatus =
  | "draft"
  | "intent_review"
  | "blueprint_generating"
  | "blueprint_ready"
  | "blueprint_approved"
  | "build_queued"
  | "building"
  | "generated"
  | "preview_ready"
  | "needs_attention"
  | "publish_ready"
  | "publishing"
  | "published"
  | "failed"
  | "archived"
  | "importing"
  | "imported"
  | "imported_needs_setup"
  | "imported_preview_ready"
  | "imported_error";

export type LifecycleContext = {
  lifecycleStatus?: string | null;
  buildStatus?: string | null;
  fileCount: number;
  hasActiveBuildJob: boolean;
  buildJobStatus?: string | null;
  publishedSubdomain?: string | null;
  publicUrl?: string | null;
  previewUrl?: string | null;
  blueprintApproved?: boolean;
  hasBlueprint?: boolean;
};

export type LifecycleMeta = {
  userLabel: string;
  adminLabel: string;
  showInDashboard: boolean;
  canOpenBuilder: boolean;
  canPreview: boolean;
  canPublish: boolean;
  generationActive: boolean;
  userActionRequired: boolean;
};

const TRANSITIONS: Record<ProjectLifecycleStatus, ProjectLifecycleStatus[]> = {
  draft: ["intent_review", "blueprint_generating", "archived"],
  intent_review: ["blueprint_generating", "draft", "archived"],
  blueprint_generating: ["blueprint_ready", "failed", "needs_attention"],
  blueprint_ready: ["blueprint_approved", "intent_review", "archived"],
  blueprint_approved: ["build_queued", "building", "archived"],
  build_queued: ["building", "failed"],
  building: ["generated", "failed", "needs_attention"],
  generated: ["preview_ready", "publish_ready", "needs_attention", "building"],
  preview_ready: ["publish_ready", "published", "needs_attention"],
  needs_attention: ["building", "generated", "failed", "archived"],
  publish_ready: ["publishing", "published"],
  publishing: ["published", "failed"],
  published: ["archived", "publish_ready"],
  failed: ["building", "draft", "needs_attention", "archived"],
  archived: ["draft"],
  importing: ["imported", "imported_needs_setup", "imported_preview_ready", "imported_error"],
  imported: ["imported_needs_setup", "imported_preview_ready", "publish_ready", "published"],
  imported_needs_setup: ["imported_preview_ready", "imported", "archived"],
  imported_preview_ready: ["publish_ready", "published", "imported_needs_setup"],
  imported_error: ["importing", "archived"],
};

export const LIFECYCLE_META: Record<ProjectLifecycleStatus, LifecycleMeta> = {
  draft: {
    userLabel: "Draft idea",
    adminLabel: "Draft — no blueprint yet",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: false,
  },
  intent_review: {
    userLabel: "Reviewing your idea",
    adminLabel: "Intent review",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: true,
  },
  blueprint_generating: {
    userLabel: "Designing blueprint",
    adminLabel: "Blueprint generating",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: true,
    userActionRequired: false,
  },
  blueprint_ready: {
    userLabel: "Blueprint ready — approve to build",
    adminLabel: "Awaiting blueprint approval",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: true,
  },
  blueprint_approved: {
    userLabel: "Ready to build",
    adminLabel: "Blueprint approved",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: false,
  },
  build_queued: {
    userLabel: "Queued for build",
    adminLabel: "Build queued",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: true,
    userActionRequired: false,
  },
  building: {
    userLabel: "Building",
    adminLabel: "Build in progress",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: true,
    userActionRequired: false,
  },
  generated: {
    userLabel: "Generated",
    adminLabel: "Files generated",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: true,
    canPublish: false,
    generationActive: false,
    userActionRequired: false,
  },
  preview_ready: {
    userLabel: "Ready to preview",
    adminLabel: "Preview ready",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: true,
    canPublish: true,
    generationActive: false,
    userActionRequired: false,
  },
  needs_attention: {
    userLabel: "Needs attention",
    adminLabel: "Needs attention / repair",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: true,
  },
  publish_ready: {
    userLabel: "Ready to publish",
    adminLabel: "Publish ready",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: true,
    canPublish: true,
    generationActive: false,
    userActionRequired: false,
  },
  publishing: {
    userLabel: "Publishing",
    adminLabel: "Publishing in progress",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: true,
    canPublish: false,
    generationActive: true,
    userActionRequired: false,
  },
  published: {
    userLabel: "Published",
    adminLabel: "Live with public URL",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: true,
    canPublish: false,
    generationActive: false,
    userActionRequired: false,
  },
  failed: {
    userLabel: "Build failed",
    adminLabel: "Failed",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: true,
  },
  archived: {
    userLabel: "Archived",
    adminLabel: "Archived",
    showInDashboard: false,
    canOpenBuilder: false,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: false,
  },
  importing: {
    userLabel: "Importing",
    adminLabel: "ZIP import in progress",
    showInDashboard: true,
    canOpenBuilder: false,
    canPreview: false,
    canPublish: false,
    generationActive: true,
    userActionRequired: false,
  },
  imported: {
    userLabel: "Imported",
    adminLabel: "ZIP imported",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: false,
  },
  imported_needs_setup: {
    userLabel: "Needs setup",
    adminLabel: "Imported — missing env/secrets",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: true,
  },
  imported_preview_ready: {
    userLabel: "Preview ready",
    adminLabel: "Imported — preview ready",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: true,
    canPublish: true,
    generationActive: false,
    userActionRequired: false,
  },
  imported_error: {
    userLabel: "Import error",
    adminLabel: "ZIP import failed",
    showInDashboard: true,
    canOpenBuilder: true,
    canPreview: false,
    canPublish: false,
    generationActive: false,
    userActionRequired: true,
  },
};

export function isLifecycleStatus(s: string): s is ProjectLifecycleStatus {
  return s in LIFECYCLE_META;
}

export function canTransition(from: ProjectLifecycleStatus, to: ProjectLifecycleStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

function readImportBlock(metadata: unknown): {
  source?: string;
  envRequirements?: string[];
  previewReady?: boolean;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const m = metadata as Record<string, unknown>;
  const imp =
    m.import && typeof m.import === "object" && !Array.isArray(m.import)
      ? (m.import as Record<string, unknown>)
      : null;
  return {
    source: typeof m.source === "string" ? m.source : undefined,
    envRequirements: Array.isArray(imp?.env_requirements)
      ? (imp.env_requirements as string[])
      : Array.isArray(m.env_requirements)
        ? (m.env_requirements as string[])
        : undefined,
    previewReady: Boolean(imp?.preview_ready ?? m.preview_ready),
  };
}

/** Derive canonical lifecycle from DB reality (fixes stale building / waiting states). */
export function normalizeProjectStatus(
  ctx: LifecycleContext,
  metadata?: unknown,
): ProjectLifecycleStatus {
  const imp = readImportBlock(metadata);
  if (imp.source === "zip_import") {
    if (ctx.fileCount === 0) return "imported_error";
    if ((imp.envRequirements?.length ?? 0) > 0) return "imported_needs_setup";
    if (imp.previewReady || ctx.previewUrl) return "imported_preview_ready";
    return "imported";
  }

  const stored = ctx.lifecycleStatus?.trim();
  if (stored && isLifecycleStatus(stored)) {
    if (
      stored === "building" &&
      !ctx.hasActiveBuildJob &&
      ctx.fileCount > 0
    ) {
      return ctx.previewUrl ? "preview_ready" : "generated";
    }
    if (stored === "building" && !ctx.hasActiveBuildJob && ctx.fileCount === 0) {
      return ctx.buildJobStatus === "failed" ? "failed" : "needs_attention";
    }
  }

  if (ctx.publicUrl || ctx.publishedSubdomain) return "published";
  if (ctx.hasActiveBuildJob) return "building";
  if (ctx.buildJobStatus === "failed") return "failed";
  if (ctx.fileCount > 0) {
    if (ctx.previewUrl) return "preview_ready";
    return "generated";
  }
  if (ctx.hasBlueprint && !ctx.blueprintApproved) return "blueprint_ready";
  if (ctx.blueprintApproved) return "blueprint_approved";

  const bs = ctx.buildStatus?.toLowerCase();
  if (bs === "completed" || bs === "succeeded") {
    return ctx.previewUrl ? "preview_ready" : "generated";
  }
  if (bs === "building" || bs === "running") {
    return ctx.hasActiveBuildJob ? "building" : ctx.fileCount > 0 ? "generated" : "needs_attention";
  }
  if (bs === "failed") return "failed";

  if (stored && isLifecycleStatus(stored)) return stored;
  return "draft";
}

/** Map lifecycle → legacy projects.status for existing UI. */
export function legacyProjectStatus(lifecycle: ProjectLifecycleStatus): "live" | "staging" | "draft" | "building" | "error" {
  if (lifecycle === "published") return "live";
  if (lifecycle === "imported_preview_ready") return "live";
  if (lifecycle === "imported") return "staging";
  if (lifecycle === "imported_needs_setup") return "draft";
  if (lifecycle === "imported_error") return "error";
  if (lifecycle === "importing") return "building";
  if (lifecycle === "building" || lifecycle === "build_queued" || lifecycle === "blueprint_generating" || lifecycle === "publishing") {
    return "building";
  }
  if (lifecycle === "failed" || lifecycle === "needs_attention") return "error";
  if (lifecycle === "preview_ready" || lifecycle === "publish_ready" || lifecycle === "generated") return "staging";
  return "draft";
}

export function readLifecycleFromMetadata(metadata: unknown): Partial<{
  lifecycle_status: ProjectLifecycleStatus;
  initial_prompt: string;
  source: string;
  workflow_step: string;
  blueprint_approved: boolean;
  public_url: string;
}> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const m = metadata as Record<string, unknown>;
  const ls = m.lifecycle_status;
  return {
    lifecycle_status: typeof ls === "string" && isLifecycleStatus(ls) ? ls : undefined,
    initial_prompt: typeof m.initial_prompt === "string" ? m.initial_prompt : undefined,
    source: typeof m.source === "string" ? m.source : undefined,
    workflow_step: typeof m.workflow_step === "string" ? m.workflow_step : undefined,
    blueprint_approved: Boolean(m.blueprint_approved_at || m.approved_blueprint),
    public_url: typeof m.public_url === "string" ? m.public_url : undefined,
  };
}

export function lifecyclePatch(
  status: ProjectLifecycleStatus,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    lifecycle_status: status,
    lifecycle_updated_at: new Date().toISOString(),
    ...extra,
  };
}
