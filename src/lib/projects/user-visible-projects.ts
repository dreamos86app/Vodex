import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";
import { isZipImportProject, readImportMeta } from "@/lib/projects/imported-project-state";
import { isFailedAttemptProject, type ProjectCardUiInput } from "@/lib/projects/project-visibility-status";

export type UserVisibleProjectRow = {
  id: string;
  name?: string | null;
  preview_url?: string | null;
  published_subdomain?: string | null;
  build_status?: string | null;
  is_favorite?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

const PLANNED_LIFECYCLES = new Set([
  "blueprint_ready",
  "blueprint_approved",
  "build_queued",
  "building",
  "generated",
  "preview_ready",
  "publish_ready",
  "publishing",
  "published",
  "needs_attention",
  "imported",
  "imported_needs_setup",
  "imported_preview_ready",
  "importing",
]);

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

function isLikelyChatDiscussion(
  name: string | null | undefined,
  fileCount: number,
  meta: Record<string, unknown>,
): boolean {
  if (fileCount > 0) return false;
  if (meta.blueprint_approved === true) return false;
  const n = (name ?? "").trim();
  if (!n || /^untitled(\s+app)?$/i.test(n)) return true;
  if (/\?/.test(n) && n.length < 140) return true;
  if (n.length > 72 && !meta.last_build_at) return true;
  return false;
}

/** Apps that belong in lists (home, Your Apps). Favorites always show. */
export function isUserVisibleProject(row: UserVisibleProjectRow): boolean {
  if (row.is_favorite) return true;

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (meta.hide_from_list === true || meta.hide_from_home === true) return false;
  if (meta.visibility_status === "archived") return false;

  const uiInput: ProjectCardUiInput = {
    id: row.id,
    build_status: row.build_status,
    metadata: meta,
    published_subdomain: row.published_subdomain,
    preview_url: row.preview_url,
  };
  if (isFailedAttemptProject(uiInput) && readFileCount(meta) === 0) {
    return false;
  }
  if (meta.shell_only === true) return false;
  if (meta.source === "question_only" || meta.intent === "question_only") return false;

  const { lifecycle_status, blueprint_approved } = readLifecycleFromMetadata(meta);
  const fileCountForFailed = readFileCount(meta);
  if (
    (lifecycle_status === "failed" || row.build_status === "failed") &&
    fileCountForFailed === 0
  ) {
    return false;
  }

  if (row.published_subdomain?.trim()) return true;

  if (isZipImportProject(meta)) {
    const imp = readImportMeta(meta);
    if ((imp.file_count ?? 0) > 0) return true;
    if (lifecycle_status?.startsWith("imported") || lifecycle_status === "importing") return true;
  }

  const fileCount = readFileCount(meta);
  if (blueprint_approved) return true;
  if (row.build_status === "completed" || row.build_status === "imported") return true;
  if (fileCount > 0) return true;
  if (row.preview_url?.trim()) return true;

  if (lifecycle_status && PLANNED_LIFECYCLES.has(lifecycle_status)) {
    if (lifecycle_status === "draft" || lifecycle_status === "intent_review") {
      return Boolean(meta.initial_prompt || meta.create_flow_state || meta.workflow_step);
    }
    if (
      fileCount === 0 &&
      !row.preview_url &&
      lifecycle_status !== "blueprint_ready" &&
      lifecycle_status !== "build_queued" &&
      lifecycle_status !== "building"
    ) {
      return lifecycle_status === "needs_attention" || lifecycle_status === "failed";
    }
    return true;
  }

  if (isLikelyChatDiscussion(row.name, fileCount, meta)) return false;
  return false;
}

/** @deprecated Use isUserVisibleProject */
export function isHomeVisibleProject(row: UserVisibleProjectRow): boolean {
  return isUserVisibleProject(row);
}
