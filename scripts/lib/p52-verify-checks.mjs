import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";

export const P52_MOBILE_UI = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/app/globals.css", "globals");
  must("src/app/globals.css", "max-width: 430px", "compact mobile breakpoint");
  must("src/app/globals.css", "--mobile-bottom-nav-height", "nav height token");
  must("src/components/chat/chat-view.tsx", "var(--mobile-bottom-nav-height", "chat composer nav clearance");
  must("src/components/chat/chat-view.tsx", "data-testid=\"chat-composer-form\"", "chat composer");
  must("src/components/layout/platform-shell.tsx", "/ai-chat", "ai-chat full bleed");
  return errors;
};

export const P52_CREDIT_TRUTH = (root) => {
  const { errors, must } = createChecker(root);
  must("src/lib/billing/plan-credit-economics.ts", "free: 20", "free build 20");
  must("src/lib/billing/plan-credit-economics.ts", "TARGET_GROSS_MARGIN_PERCENT = 75", "p53 margin target");
  must("src/lib/credits/canonical-credits.ts", "loadCanonicalCredits", "canonical loader");
  must("src/lib/credits/credit-balance-display.ts", "formatCreditBucketDisplay", "unified display");
  must("src/lib/credits/credit-summary.ts", "formatCreditAmount", "decimal display");
  must("src/lib/billing/mid-cycle-upgrade-credits.ts", "newBuildCap - oldBuildCap", "upgrade delta");
  return errors;
};

export const P52_CREDIT_RESET = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/lib/billing/sync-plan-credits.ts", "sync plan credits");
  must("src/lib/billing/sync-plan-credits.ts", "credits_reset_at", "reset date");
  must("src/lib/credits/explicit-grants.ts", "creditPeriodStart", "period start");
  mustExist("supabase/migrations/20260825120000_p52_production_ux_billing.sql", "p52 migration");
  return errors;
};

export const P52_ACTION_CREDIT_SPENDING = (root) => {
  const { errors, must } = createChecker(root);
  must("src/lib/action-credits/charge-action-credit.ts", "chargeActionCredit", "charge helper");
  must("src/lib/imports/zip-preview-action-credits.ts", "estimatedActionCredits", "zip preview pricing");
  must("src/lib/imports/zip-preview-action-credits.ts", "commitActionCreditHold", "zip preview charge");
  must("src/components/apps/zip-import-wizard.tsx", "Action Credits", "zip UI");
  must("src/lib/action-credits/logo-generation-pricing.ts", "app_logo_generation", "logo pricing");
  must("src/lib/projects/app-identity-service.ts", "chargeActionCredit", "logo generation charge");
  must("src/lib/action-credits/runtime-owner-metering.ts", "meterRuntimeActionForOwner", "runtime metering");
  must("src/app/api/projects/[id]/mobile/build/route.ts", "chargeActionCredit", "android build charge");
  return errors;
};

export const P52_NOTIFICATION_REALTIME = (root) => {
  const { errors, must } = createChecker(root);
  must("src/components/providers/app-provider.tsx", "notifications", "notifications channel");
  must("src/components/providers/app-provider.tsx", "setInterval(pollNotifications", "poll fallback");
  must("src/components/providers/app-provider.tsx", "visibilitychange", "visibility refresh");
  must("src/components/notifications/notification-panel.tsx", "NotificationBell", "bell");
  return errors;
};

export const P52_PRESENCE = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/hooks/use-presence-heartbeat.ts", "heartbeat hook");
  must("src/hooks/use-presence-heartbeat.ts", "visibilitychange", "visibility");
  mustExist("src/app/api/user/presence/heartbeat/route.ts", "heartbeat api");
  mustExist("supabase/migrations/20260729120000_p22_user_presence.sql", "presence table");
  return errors;
};

export const P52_VERSION_HISTORY = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/lib/projects/app-version-history.ts", "version lib");
  mustExist("src/app/api/projects/[id]/versions/route.ts", "versions api");
  must("supabase/migrations/20260825120000_p52_production_ux_billing.sql", "app_versions", "app_versions table");
  must("src/lib/build/persist-generated-files.ts", "saveAppVersionSnapshot", "persist hook");
  must("src/app/api/editor/apply-diff/route.ts", "saveAppVersionSnapshot", "manual edit hook");
  must("src/app/api/editor/apply-diff/route.ts", "manual_edit", "manual edit mode");
  must("src/components/builder/app-builder-workspace.tsx", "AppVersionHistoryPanel", "builder version panel");
  return errors;
};

export const P52_WORKSPACE_AUDIT = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("supabase/migrations/20260826120000_p52b_workspace_audit_free_20.sql", "p52b migration");
  must("supabase/migrations/20260826120000_p52b_workspace_audit_free_20.sql", "when 'free' then 20", "free 20 rpc");
  must("supabase/migrations/20260826120000_p52b_workspace_audit_free_20.sql", "credit_events", "credit_events workspace");
  must("supabase/migrations/20260826120000_p52b_workspace_audit_free_20.sql", "mobile_build_jobs", "mobile jobs workspace");
  return errors;
};

export const P52_CHAT_PERSISTENCE = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/app/api/conversations/route.ts", "list conversations");
  mustExist("src/app/api/conversations/[id]/route.ts", "manage conversation");
  must("src/app/api/conversations/[id]/route.ts", "archived", "soft delete");
  mustExist("src/components/chat/chat-delete-confirm-modal.tsx", "delete modal");
  must("src/components/chat/chat-view.tsx", "ChatDeleteConfirmModal", "wired delete");
  mustExist("src/lib/ai/discuss-mode-policy.ts", "discuss policy");
  must("src/components/chat/chat-view.tsx", "DISCUSS_MODEL_AUTO", "no user model picker");
  return errors;
};

export const P52_UNIT_ECONOMICS = (root) => {
  const errors = [];
  const p = path.join(root, "scripts/audit-unit-economics.mjs");
  if (!fs.existsSync(p)) errors.push("audit-unit-economics.mjs missing");
  else {
    const src = fs.readFileSync(p, "utf8");
    if (!src.includes("Gross margin")) errors.push("unit economics must print gross margin");
    if (!src.includes("ASSUMPTIONS")) errors.push("unit economics must document assumptions");
  }
  return errors;
};
