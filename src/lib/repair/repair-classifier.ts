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
  | "incomplete_source"
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
  sourceIncomplete?: boolean;
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
  previewErrorCode?: string | null;
  previewUserMessage?: string | null;
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
  } else if (
    input.sourceIncomplete === true &&
    !(input.previewError && (input.fileCount ?? 0) >= 25)
  ) {
    issues.push(
      aiIssue(
        "incomplete_source",
        "Generated files are incomplete",
        "File paths exist but source content is missing or too thin to render.",
        "Preview and the code editor need real React source, not empty stubs.",
        "Run repair to generate the missing code for your routes and components.",
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
    const code = input.previewErrorCode ?? "";
    const oom = code === "VITE_BUILD_OOM" || /out of memory/i.test(input.previewError);
    const substantial = (input.fileCount ?? 0) >= 25;
    issues.push({
      type: "preview_failed",
      title: oom
        ? "Preview build out of memory"
        : substantial
          ? "Preview build failed"
          : "Preview build failed",
      summary: input.previewUserMessage ?? input.previewError,
      whatHappened: input.previewUserMessage ?? input.previewError,
      whyItMatters: "ZIP and framework previews require a successful worker build.",
      exactFix: oom
        ? "Increase preview worker memory on Railway (2–4GB) or reduce bundle size, then rebuild preview."
        : "Open preview runtime logs, fix the build error, then use Rebuild preview.",
      severity: "high",
      needsAi: false,
      technicalDetails: {
        errorCode: code || null,
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

  const priority: Record<RepairIssueType, number> = {
    auth_session: 0,
    migration_missing: 1,
    preview_failed: 2,
    build_failed: 3,
    validation_failed: 4,
    incomplete_source: 9,
    no_files: 8,
    generated_placeholder: 5,
    publish_failed: 6,
    insufficient_credits: 4,
    missing_env: 7,
    vercel_not_connected: 10,
    token_invalid: 10,
    provider_cap_hit: 11,
    stale_lifecycle: 12,
    missing_id: 13,
  };

  return issues.sort((a, b) => (priority[a.type] ?? 50) - (priority[b.type] ?? 50));
}
