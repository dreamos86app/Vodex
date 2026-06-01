import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { persistBuildJobEvent, type BuildJobEventType } from "@/lib/build/build-job-events";

type Writer = SupabaseClient<Database>;

export type WorkflowStreamEventType =
  | "workflow_started"
  | "step_started"
  | "step_progress"
  | "step_completed"
  | "step_failed"
  | "file_created"
  | "file_updated"
  | "file_deleted"
  | "file_validated"
  | "preview_started"
  | "preview_warming"
  | "preview_rendered"
  | "preview_failed"
  | "repair_started"
  | "repair_completed"
  | "build_completed"
  | "build_failed";

export type WorkflowStepCtx = {
  jobId: string;
  projectId: string;
  userId: string;
};

const STEP_JOB_TYPE: Partial<Record<string, BuildJobEventType>> = {
  planning: "planning_app",
  identity: "generating_app_identity",
  icon: "generating_app_icon",
  writing: "writing_file",
  validating: "checking_file",
  preview: "preparing_preview",
  saving: "saving_files",
  repair: "fixing_error",
};

function baseMeta(
  eventType: WorkflowStreamEventType,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    workflow_event_type: eventType,
    ...extra,
  };
}

export async function emitWorkflowStarted(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input?: { message?: string },
): Promise<void> {
  await persistBuildJobEvent(writer, {
    ...ctx,
    type: "job_created",
    title: "Starting your build",
    detail: input?.message ?? "Workflow started",
    progressPercent: 1,
    metadata: baseMeta("workflow_started", { step_status: "completed" }),
  });
}

export async function emitWorkflowStepStarted(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: {
    stepId: string;
    label: string;
    sublabel?: string;
    progressPercent?: number;
    jobType?: BuildJobEventType;
  },
): Promise<void> {
  const jobType = input.jobType ?? STEP_JOB_TYPE[input.stepId] ?? "understanding_request";
  await persistBuildJobEvent(writer, {
    ...ctx,
    type: jobType,
    title: input.label,
    detail: input.sublabel ?? input.label,
    progressPercent: input.progressPercent,
    metadata: baseMeta("step_started", {
      step_id: input.stepId,
      step_status: "active",
      stream_category: "phase_started",
      display_title: input.label,
    }),
  });
}

export async function emitWorkflowStepProgress(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: {
    stepId: string;
    label: string;
    message?: string;
    progressPercent?: number;
    jobType?: BuildJobEventType;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const jobType = input.jobType ?? STEP_JOB_TYPE[input.stepId] ?? "understanding_request";
  await persistBuildJobEvent(writer, {
    ...ctx,
    type: jobType,
    title: input.label,
    detail: input.message ?? input.label,
    progressPercent: input.progressPercent,
    metadata: baseMeta("step_progress", {
      step_id: input.stepId,
      step_status: "active",
      ...input.metadata,
    }),
  });
}

export async function emitWorkflowStepCompleted(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: {
    stepId: string;
    label: string;
    progressPercent?: number;
    jobType?: BuildJobEventType;
  },
): Promise<void> {
  const jobType = input.jobType ?? STEP_JOB_TYPE[input.stepId] ?? "understanding_request";
  await persistBuildJobEvent(writer, {
    ...ctx,
    type: jobType,
    title: input.label,
    detail: input.label,
    progressPercent: input.progressPercent,
    metadata: baseMeta("step_completed", {
      step_id: input.stepId,
      step_status: "completed",
      stream_category: "phase_started",
      display_title: input.label,
    }),
  });
}

export async function emitWorkflowStepFailed(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: {
    stepId: string;
    label: string;
    message: string;
    failureCode?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await persistBuildJobEvent(writer, {
    ...ctx,
    type: "failed",
    title: input.label,
    detail: input.message,
    progressPercent: 100,
    metadata: baseMeta("step_failed", {
      step_id: input.stepId,
      step_status: "failed",
      failure_code: input.failureCode,
      failure_kind: "failed_after_generation",
      ...input.metadata,
    }),
  });
}

export async function emitFileWriteEvent(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: {
    action: "created" | "updated" | "deleted";
    filePath: string;
    linesAdded?: number;
    linesRemoved?: number;
    currentFile?: number;
    totalFiles?: number;
    progressPercent?: number;
  },
): Promise<void> {
  const verb =
    input.action === "created" ? "Created" : input.action === "deleted" ? "Deleted" : "Edited";
  const eventType: WorkflowStreamEventType =
    input.action === "created"
      ? "file_created"
      : input.action === "deleted"
        ? "file_deleted"
        : "file_updated";
  const detail =
    input.linesAdded != null || input.linesRemoved != null
      ? `+${input.linesAdded ?? 0} -${input.linesRemoved ?? 0}`
      : input.filePath;

  await persistBuildJobEvent(writer, {
    ...ctx,
    type: input.action === "deleted" ? "editing_file" : "writing_file",
    title: `${verb} ${input.filePath}`,
    detail,
    filePath: input.filePath,
    progressPercent: input.progressPercent,
    metadata: baseMeta(eventType, {
      step_status: "completed",
      stream_category: input.action === "created" ? "file_created" : "file_edited",
      added_lines: input.linesAdded,
      removed_lines: input.linesRemoved,
      current_file: input.currentFile,
      total_files: input.totalFiles,
      file_path: input.filePath,
    }),
  });
}

export async function emitPreviewWorkflowEvent(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: {
    phase: "started" | "warming" | "rendered" | "failed";
    message: string;
    failureCode?: string;
    progressPercent?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const eventType: WorkflowStreamEventType =
    input.phase === "started"
      ? "preview_started"
      : input.phase === "warming"
        ? "preview_warming"
        : input.phase === "rendered"
          ? "preview_rendered"
          : "preview_failed";

  await persistBuildJobEvent(writer, {
    ...ctx,
    type: input.phase === "failed" ? "failed" : "preparing_preview",
    title:
      input.phase === "started"
        ? "Starting preview render"
        : input.phase === "warming"
          ? "Preview is warming"
          : input.phase === "rendered"
            ? "Preview rendered successfully"
            : "Files saved, preview render failed",
    detail: input.message,
    progressPercent: input.progressPercent ?? (input.phase === "rendered" ? 98 : 92),
    metadata: baseMeta(eventType, {
      step_status: input.phase === "rendered" ? "completed" : input.phase === "failed" ? "failed" : "active",
      preview_failure_code: input.failureCode,
      stream_category: input.phase === "rendered" ? "preview_ready" : "phase_started",
      ...input.metadata,
    }),
  });
}

export async function emitRepairWorkflowEvent(
  writer: Writer,
  ctx: WorkflowStepCtx,
  input: { phase: "started" | "completed"; message: string; progressPercent?: number },
): Promise<void> {
  await persistBuildJobEvent(writer, {
    ...ctx,
    type: "fixing_error",
    title: input.phase === "started" ? "Repairing preview" : "Repair complete",
    detail: input.message,
    progressPercent: input.progressPercent,
    metadata: baseMeta(input.phase === "started" ? "repair_started" : "repair_completed", {
      step_status: input.phase === "completed" ? "completed" : "active",
      repair_pass: true,
      stream_category: "repair_started",
    }),
  });
}
