export type RepairIssueType =
  | "migration_missing"
  | "preview_failed"
  | "build_failed"
  | "validation_failed"
  | "publish_failed"
  | "missing_env"
  | "insufficient_credits"
  | "stale_lifecycle"
  | "missing_id"
  | "vercel_not_connected"
  | "token_invalid"
  | "generated_placeholder"
  | "no_files"
  | "provider_cap_hit"
  | "auth_session";

export type RepairIssue = {
  type: RepairIssueType;
  title: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  exactFix: string;
  severity: "low" | "medium" | "high";
  needsAi: boolean;
  estimatedCredits?: number;
  technicalDetails: Record<string, unknown>;
  sqlFile?: string;
};

const REPAIR_CREDIT_ESTIMATES: Partial<Record<RepairIssueType, number>> = {
  no_files: 50,
  build_failed: 30,
  validation_failed: 25,
  generated_placeholder: 25,
};

function aiIssue(
  type: RepairIssueType,
  title: string,
  whatHappened: string,
  whyItMatters: string,
  exactFix: string,
  severity: RepairIssue["severity"],
  technicalDetails: Record<string, unknown> = {},
): RepairIssue {
  const needsAi = type in REPAIR_CREDIT_ESTIMATES;
  return {
    type,
    title,
    summary: whatHappened,
    whatHappened,
    whyItMatters,
    exactFix,
    severity,
    needsAi,
    estimatedCredits: REPAIR_CREDIT_ESTIMATES[type],
    technicalDetails,
  };
}

export function classifyRepairIssues(input: {
  lifecycleStatus?: string | null;
  buildStatus?: string | null;
  fileCount?: number;
  previewError?: string | null;
  publishError?: string | null;
  validationReasons?: string[];
  creditsRemaining?: number;
  creditsRequired?: number;
  missingEnv?: string[];
  vercelConnected?: boolean;
  vercelTokenInvalid?: boolean;
  migrationMissing?: boolean;
  providerCapHit?: boolean;
  authSessionProblem?: boolean;
  previewLogs?: string[];
}): RepairIssue[] {
  const issues: RepairIssue[] = [];
  const validation = input.validationReasons ?? [];

  if (input.authSessionProblem) {
    issues.push({
      type: "auth_session",
      title: "Session expired",
      summary: "Your sign-in session is no longer valid.",
      whatHappened: "The server could not verify your session.",
      whyItMatters: "Repairs and saves require an active sign-in.",
      exactFix: "Sign in again, then return to this app and run repair.",
      severity: "high",
      needsAi: false,
      technicalDetails: { code: "session_expired" },
    });
  }

  if (input.migrationMissing) {
    issues.push({
      type: "migration_missing",
      title: "Database migration missing",
      summary: "A required Supabase migration has not been applied.",
      whatHappened: "Runtime schema checks reported missing tables or columns.",
      whyItMatters: "Build, preview, and publish may fail until the schema matches.",
      exactFix: "Apply the runtime repair SQL in Supabase SQL editor, then reconcile status.",
      severity: "high",
      needsAi: false,
      sqlFile: "scripts/dreamos-runtime-repair.sql",
      technicalDetails: { sqlFile: "scripts/dreamos-runtime-repair.sql" },
    });
  }

  if ((input.fileCount ?? 0) < 1) {
    issues.push(
      aiIssue(
        "no_files",
        "No generated files",
        "This project has no app files yet.",
        "Preview and publish require at least one generated file.",
        "Run a build from the create flow or use AI repair to generate starter files.",
        "high",
        { fileCount: input.fileCount ?? 0 },
      ),
    );
  }

  const placeholderHit =
    validation.some((r) => /placeholder|sample item|lorem|generic ui/i.test(r)) ||
    validation.some((r) => r.startsWith("ui_quality_low"));
  if (placeholderHit) {
    issues.push(
      aiIssue(
        "generated_placeholder",
        "Placeholder content detected",
        "Generated files still contain placeholder or generic UI patterns.",
        "Published apps with placeholders look unfinished and fail quality checks.",
        "Run AI repair to replace placeholders with real UI for your app type.",
        "high",
        { validationReasons: validation.slice(0, 5) },
      ),
    );
  }

  if (input.lifecycleStatus === "needs_attention" || input.buildStatus === "failed") {
    issues.push(
      aiIssue(
        "build_failed",
        "Build failed or needs attention",
        "The last build did not complete successfully.",
        "You cannot preview or publish until the build is healthy.",
        "Retry from the builder or run AI repair after reviewing the quote.",
        "high",
        { lifecycleStatus: input.lifecycleStatus, buildStatus: input.buildStatus },
      ),
    );
  }

  if (validation.length > 0 && !placeholderHit) {
    issues.push(
      aiIssue(
        "validation_failed",
        "Quality validation failed",
        validation.slice(0, 2).join("; "),
        "Validation catches broken routes, missing pages, and incomplete UI before users see them.",
        "Run AI repair to fix validation issues, or edit files manually in the builder.",
        "high",
        { validationReasons: validation.slice(0, 10) },
      ),
    );
  }

  if (input.previewError) {
    issues.push({
      type: "preview_failed",
      title: "Preview failed",
      summary: input.previewError,
      whatHappened: input.previewError,
      whyItMatters: "You need a working preview before publishing.",
      exactFix: "Check preview logs, fix reported issues, then retry preview.",
      severity: "medium",
      needsAi: false,
      technicalDetails: {
        lastPreviewError: input.previewError,
        logs: input.previewLogs?.slice(-20) ?? [],
      },
    });
  }

  if (input.publishError) {
    issues.push({
      type: "publish_failed",
      title: "Publish blocked",
      summary: input.publishError,
      whatHappened: input.publishError,
      whyItMatters: "Your app cannot go live until publish blockers are resolved.",
      exactFix: "Fix readiness blockers, ensure preview works, then publish again.",
      severity: "medium",
      needsAi: false,
      technicalDetails: { publishError: input.publishError },
    });
  }

  if (
    input.creditsRequired != null &&
    input.creditsRemaining != null &&
    input.creditsRemaining < input.creditsRequired
  ) {
    issues.push({
      type: "insufficient_credits",
      title: "Insufficient credits",
      summary: `Need ${input.creditsRequired} credits; you have ${input.creditsRemaining}.`,
      whatHappened: `This action requires ${input.creditsRequired} credits but your balance is ${input.creditsRemaining}.`,
      whyItMatters: "AI repair and builds are paused until you have enough credits.",
      exactFix: "Add credits in billing settings, then return and run repair.",
      severity: "high",
      needsAi: false,
      technicalDetails: {
        creditsRequired: input.creditsRequired,
        creditsRemaining: input.creditsRemaining,
      },
    });
  }

  if (input.missingEnv?.length) {
    issues.push({
      type: "missing_env",
      title: "Missing environment variables",
      summary: input.missingEnv.join(", "),
      whatHappened: `Required env vars are not set: ${input.missingEnv.join(", ")}`,
      whyItMatters: "Integrations and deploy steps may fail without these values.",
      exactFix: "Add the missing variables in project secrets or settings, then retry.",
      severity: "medium",
      needsAi: false,
      technicalDetails: { missingEnv: input.missingEnv },
    });
  }

  if (input.vercelTokenInvalid) {
    issues.push({
      type: "token_invalid",
      title: "Vercel token invalid",
      summary: "The connected Vercel token was rejected.",
      whatHappened: "Vercel API returned an authentication error for this project.",
      whyItMatters: "External preview and deploy will not work until reconnected.",
      exactFix: "Reconnect Vercel in Settings → Integrations with a valid token.",
      severity: "medium",
      needsAi: false,
      technicalDetails: { vercelTokenInvalid: true },
    });
  } else if (input.vercelConnected === false) {
    issues.push({
      type: "vercel_not_connected",
      title: "Vercel not connected",
      summary: "Connect Vercel to deploy and use hosted preview.",
      whatHappened: "No Vercel integration is linked to this workspace.",
      whyItMatters: "In-app preview works, but hosted deploy requires Vercel.",
      exactFix: "Open Settings → Integrations → Connect Vercel, then retry preview or deploy.",
      severity: "low",
      needsAi: false,
      technicalDetails: { vercelConnected: false },
    });
  }

  if (input.providerCapHit) {
    issues.push({
      type: "provider_cap_hit",
      title: "Provider usage cap reached",
      summary: "AI provider budget cap was hit for this operation.",
      whatHappened: "The model provider rejected or throttled the request due to cost caps.",
      whyItMatters: "AI repair cannot run until caps reset or a cheaper path is used.",
      exactFix: "Wait a few minutes and retry, or use manual edits in the builder.",
      severity: "medium",
      needsAi: false,
      technicalDetails: { providerCapHit: true },
    });
  }

  if (input.lifecycleStatus === "building" && input.buildStatus === "building") {
    issues.push({
      type: "stale_lifecycle",
      title: "Stale build state",
      summary: "Build status has not updated — it may have stopped unexpectedly.",
      whatHappened: "Lifecycle shows building but no active progress was detected.",
      whyItMatters: "Stale state blocks preview and publish actions.",
      exactFix: "Run Reconcile status to sync lifecycle with actual files and jobs.",
      severity: "medium",
      needsAi: false,
      technicalDetails: { lifecycleStatus: input.lifecycleStatus, buildStatus: input.buildStatus },
    });
  }

  return issues;
}
