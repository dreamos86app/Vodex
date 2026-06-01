/**
 * Canonical project list visibility — Home, Apps, APIs.
 */
import {
  computeProjectCardStatus,
  projectCardStatusCtas,
  projectCardStatusDisplay,
  type ProjectCardStatus,
  type ProjectCardStatusInput,
} from "@/lib/projects/project-card-status";
import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";

export type ProjectVisibilityStatus =
  | "ready"
  | "draft"
  | "draft_pending"
  | "failed_attempt"
  | "archived";

export type ProjectVisibilitySection = "ready" | "drafts" | "failed_attempts";

export type ProjectCardUiInput = ProjectCardStatusInput & {
  id: string;
  published_subdomain?: string | null;
  preview_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProjectCardUiState = {
  visibility_status: ProjectVisibilityStatus;
  visibility_section: ProjectVisibilitySection;
  card_status: ProjectCardStatus;
  status_label: string;
  status_description: string;
  primary_cta: { label: string; href: string } | null;
  secondary_cta: { label: string; href: string } | null;
};

function readFileCount(meta: Record<string, unknown>): number {
  if (typeof meta.file_count === "number") return meta.file_count;
  if (typeof meta.generated_file_count === "number") return meta.generated_file_count;
  const builder = meta.builder;
  if (builder && typeof builder === "object" && !Array.isArray(builder)) {
    const pages = (builder as Record<string, unknown>).pages;
    if (Array.isArray(pages) && pages.length > 0) return pages.length;
  }
  return 0;
}

function readVisibilityStatus(meta: Record<string, unknown>): ProjectVisibilityStatus | null {
  const raw = meta.visibility_status;
  if (
    raw === "ready" ||
    raw === "draft" ||
    raw === "draft_pending" ||
    raw === "failed_attempt" ||
    raw === "archived"
  ) {
    return raw;
  }
  return null;
}

export function hasMeaningfulProjectFiles(meta: Record<string, unknown>): boolean {
  if (readFileCount(meta) > 0) return true;
  if (meta.source_integrity_ok === true) return true;
  if (meta.preview_renderable === true) return true;
  return false;
}

export function computeProjectCardUiState(
  input: ProjectCardUiInput,
  options?: { isAdmin?: boolean },
): ProjectCardUiState {
  const meta = input.metadata ?? {};
  const card_status = computeProjectCardStatus(input);
  const display = projectCardStatusDisplay(card_status);
  const ctas = projectCardStatusCtas(input.id, card_status, { isAdmin: options?.isAdmin });
  const buildStatus = String(input.build_status ?? meta.build_status ?? "").toLowerCase();
  const fileCount = readFileCount(meta);
  const meaningfulFiles = hasMeaningfulProjectFiles(meta);
  const published = Boolean(input.published_subdomain?.trim());
  const { lifecycle_status } = readLifecycleFromMetadata(meta);
  const storedVisibility = readVisibilityStatus(meta);

  let visibility_status: ProjectVisibilityStatus;
  if (storedVisibility === "archived") {
    visibility_status = "archived";
  } else if (published || card_status === "ready") {
    visibility_status = "ready";
  } else if (
    storedVisibility === "failed_attempt" ||
    (!meaningfulFiles &&
      (buildStatus === "failed" || card_status === "failed" || lifecycle_status === "failed"))
  ) {
    visibility_status = "failed_attempt";
  } else if (storedVisibility === "draft_pending" || (!meaningfulFiles && buildStatus !== "completed")) {
    visibility_status = meaningfulFiles ? "draft" : "draft_pending";
  } else {
    visibility_status = "draft";
  }

  let visibility_section: ProjectVisibilitySection;
  if (visibility_status === "ready") {
    visibility_section = "ready";
  } else if (visibility_status === "failed_attempt") {
    visibility_section = meaningfulFiles ? "drafts" : "failed_attempts";
  } else {
    visibility_section = "drafts";
  }

  const status_description =
    card_status === "preview_failed"
      ? "Preview could not load — repair from the builder."
      : card_status === "building"
        ? "Build in progress."
        : card_status === "failed"
          ? "Build did not complete."
          : visibility_status === "draft_pending"
            ? "Draft — still setting up."
            : "Unpublished draft.";

  return {
    visibility_status,
    visibility_section,
    card_status,
    status_label: display.label,
    status_description,
    primary_cta: ctas[0] ? { label: ctas[0].label, href: ctas[0].href } : null,
    secondary_cta: ctas[1] ? { label: ctas[1].label, href: ctas[1].href } : null,
  };
}

/** Main “Your apps” row — ready/published only. */
export function isMainAppsListProject(
  row: ProjectCardUiInput & { is_favorite?: boolean | null },
): boolean {
  if (row.is_favorite) return true;
  const ui = computeProjectCardUiState(row);
  return ui.visibility_section === "ready";
}

/** Drafts section — incomplete/unpublished/recoverable. */
export function isDraftsListProject(row: ProjectCardUiInput): boolean {
  const ui = computeProjectCardUiState(row);
  return ui.visibility_section === "drafts";
}

/** Failed first-prompt shells — drafts UI or hidden from main. */
export function isFailedAttemptProject(row: ProjectCardUiInput): boolean {
  const ui = computeProjectCardUiState(row);
  return ui.visibility_status === "failed_attempt";
}
