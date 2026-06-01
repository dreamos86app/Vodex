/**
 * Canonical project card status — single source for home, apps grid, and build-status API.
 */

export type ProjectCardStatus =
  | "building"
  | "preview_preparing"
  | "preview_failed"
  | "ready"
  | "failed";

export type ProjectCardStatusInput = {
  build_status?: string | null;
  metadata?: Record<string, unknown> | null;
  /** When files are loaded (build-status API), use integrity + root page for ready gate. */
  previewIntegrity?: {
    previewRenderable: boolean;
    sourceIntegrityOk: boolean;
    hasRootPage: boolean;
  };
};

export function computeProjectCardStatus(input: ProjectCardStatusInput): ProjectCardStatus {
  const meta = input.metadata ?? {};
  const buildStatus = String(input.build_status ?? "").toLowerCase();
  const previewFailed =
    buildStatus === "preview_failed" || Boolean(meta.files_ready_preview_failed);

  if (buildStatus === "running" || buildStatus === "queued") {
    return "building";
  }
  if (previewFailed) {
    return "preview_failed";
  }
  if (buildStatus === "failed") {
    return "failed";
  }

  const integrity = input.previewIntegrity;
  if (integrity) {
    const previewRenderable = integrity.previewRenderable && !previewFailed;
    if (previewRenderable && integrity.sourceIntegrityOk && integrity.hasRootPage) {
      return "ready";
    }
    if (buildStatus === "completed" || buildStatus === "succeeded" || buildStatus === "imported") {
      return "preview_preparing";
    }
    return "preview_preparing";
  }

  if (buildStatus === "imported") {
    const imp =
      meta.import && typeof meta.import === "object" && !Array.isArray(meta.import)
        ? (meta.import as { file_count?: number })
        : {};
    if ((imp.file_count ?? 0) > 0 || meta.preview_renderable === true) {
      return "ready";
    }
    return "preview_preparing";
  }

  const previewRenderable = meta.preview_renderable === true && !previewFailed;
  const integrityOk = meta.source_integrity_ok !== false;
  if (previewRenderable && integrityOk) {
    return "ready";
  }
  if (buildStatus === "completed" || buildStatus === "succeeded") {
    return "preview_preparing";
  }
  return "preview_preparing";
}

export const PROJECT_CARD_STATUS_LABEL: Record<ProjectCardStatus, string> = {
  building: "Building",
  preview_preparing: "Preparing preview",
  preview_failed: "Preview failed",
  ready: "Ready",
  failed: "Failed",
};

export type ProjectCardStatusTone = "default" | "positive" | "warning" | "destructive" | "building";

export const PROJECT_CARD_STATUS_TONE: Record<ProjectCardStatus, ProjectCardStatusTone> = {
  building: "building",
  preview_preparing: "warning",
  preview_failed: "destructive",
  ready: "positive",
  failed: "destructive",
};

export function projectCardStatusDisplay(status: ProjectCardStatus): {
  label: string;
  tone: ProjectCardStatusTone;
} {
  return {
    label: PROJECT_CARD_STATUS_LABEL[status],
    tone: PROJECT_CARD_STATUS_TONE[status],
  };
}

export function isProjectCardPreviewReady(status: ProjectCardStatus): boolean {
  return status === "ready";
}

export type ProjectCardStatusCta = {
  label: string;
  href: string;
};

export function projectCardStatusCtas(
  projectId: string,
  status: ProjectCardStatus,
  options?: { isAdmin?: boolean },
): ProjectCardStatusCta[] {
  const ctas: ProjectCardStatusCta[] = [];
  if (status === "preview_failed") {
    ctas.push({
      label: "Repair preview",
      href: `/apps/${projectId}/builder?repair=preview`,
    });
  }
  if (status === "failed") {
    ctas.push({
      label: "Retry build",
      href: `/apps/${projectId}/builder?retry=1`,
    });
  }
  if (options?.isAdmin) {
    ctas.push({
      label: "Open diagnostics",
      href: `/apps/${projectId}/builder?diagnostics=1`,
    });
  }
  return ctas;
}
