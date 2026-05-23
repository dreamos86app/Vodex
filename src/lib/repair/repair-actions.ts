import type { RepairIssueType } from "@/lib/repair/repair-classifier";

export type RepairActionKind =
  | "retry_build"
  | "retry_preview"
  | "open_billing"
  | "open_integrations"
  | "run_ai_repair"
  | "reconcile"
  | "show_sql"
  | "open_builder"
  | "rollback_checkpoint";

export type RepairAction = {
  type: RepairIssueType;
  label: string;
  action: RepairActionKind;
  href?: string;
  sqlFile?: string;
  issueType?: RepairIssueType;
};

export function repairActionsFor(type: RepairIssueType, projectId: string): RepairAction[] {
  switch (type) {
    case "migration_missing":
      return [
        {
          type,
          label: "View repair SQL",
          action: "show_sql",
          sqlFile: "scripts/dreamos-runtime-repair.sql",
          issueType: type,
        },
        { type, label: "Reconcile status", action: "reconcile", issueType: type },
      ];
    case "insufficient_credits":
      return [{ type, label: "Add credits", action: "open_billing", href: "/settings/billing", issueType: type }];
    case "vercel_not_connected":
    case "token_invalid":
      return [
        {
          type,
          label: "Connect Vercel",
          action: "open_integrations",
          href: "/settings/integrations",
          issueType: type,
        },
      ];
    case "auth_session":
      return [{ type, label: "Sign in again", action: "open_billing", href: "/auth/login", issueType: type }];
    case "provider_cap_hit":
      return [
        { type, label: "Reconcile status", action: "reconcile", issueType: type },
        { type, label: "Open builder", action: "open_builder", href: `/apps/${projectId}/builder`, issueType: type },
      ];
    case "no_files":
    case "build_failed":
    case "validation_failed":
    case "generated_placeholder":
      return [
        { type, label: "Run repair", action: "run_ai_repair", issueType: type },
        { type, label: "Open builder", action: "open_builder", href: `/apps/${projectId}/builder`, issueType: type },
        { type, label: "Rollback", action: "rollback_checkpoint", issueType: type },
      ];
    case "preview_failed":
      return [
        { type, label: "Retry preview", action: "retry_preview", issueType: type },
        { type, label: "Run repair", action: "run_ai_repair", issueType: type },
        { type, label: "Open builder", action: "open_builder", href: `/apps/${projectId}/builder`, issueType: type },
      ];
    case "publish_failed":
      return [
        { type, label: "Check readiness", action: "retry_preview", href: `/apps/${projectId}/dashboard?tab=publish`, issueType: type },
        { type, label: "Reconcile status", action: "reconcile", issueType: type },
      ];
    case "missing_env":
      return [
        { type, label: "Open secrets", action: "open_builder", href: `/apps/${projectId}/dashboard?tab=secrets`, issueType: type },
      ];
    case "stale_lifecycle":
      return [{ type, label: "Reconcile status", action: "reconcile", issueType: type }];
    case "missing_id":
      return [{ type, label: "Back to dashboard", action: "open_builder", href: "/dashboard", issueType: type }];
    default:
      return [{ type, label: "Open builder", action: "open_builder", href: `/apps/${projectId}/builder`, issueType: type }];
  }
}
