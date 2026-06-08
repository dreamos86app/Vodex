/**
 * When generated app_files may be cleared after a failed build job.
 */
export type ClearGeneratedFilesContext =
  | "contract_failed_before_persist"
  | "quality_blocked_failed_draft"
  | "persist_failed"
  | "preview_failed_after_persist"
  | "admin_cleanup"
  | "rollback_before_files_ready";

export function mayClearGeneratedFiles(ctx: ClearGeneratedFilesContext): boolean {
  switch (ctx) {
    case "contract_failed_before_persist":
    case "quality_blocked_failed_draft":
    case "persist_failed":
    case "admin_cleanup":
    case "rollback_before_files_ready":
      return true;
    case "preview_failed_after_persist":
      return false;
    default:
      return false;
  }
}
