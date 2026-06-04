export type PreviewRuntimeStatusPayload = {
  previewRenderable: boolean;
  previewHonest: boolean;
  previewStatus: string;
  jobStatus: string | null;
  jobId: string | null;
  framework: string | null;
  frameworkLabel: string | null;
  artifactPath: string | null;
  blockedReason: string | null;
  buildLogs: string | null;
  lockedBy: string | null;
  workerUnavailable: boolean;
  workerConnected: boolean;
  workerUnavailableMessage: string | null;
  lastPreviewBuildAt: string | null;
  entryFile: string | null;
  warnings: string[];
};

export function previewRuntimeStateLabel(status: PreviewRuntimeStatusPayload): string {
  if (status.previewRenderable) return "Preview ready";
  if (status.jobStatus === "running") return "Preview building";
  if (status.jobStatus === "queued" || status.previewStatus === "queued") return "Preview queued";
  if (status.jobStatus === "failed" || status.previewStatus === "failed") return "Preview failed";
  if (status.workerUnavailable) return "Worker unavailable";
  return "Preview not ready";
}
