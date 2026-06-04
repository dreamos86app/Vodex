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
  /** ISO timestamp of latest preview_build_jobs row */
  jobCreatedAt: string | null;
  /** Human-readable queue age, e.g. "4m 12s" */
  jobAgeLabel: string | null;
  jobAgeSeconds: number | null;
  /** True on Vercel/serverless — builds require a deployed preview worker */
  requiresDeployedWorker: boolean;
  lastPreviewBuildAt: string | null;
  entryFile: string | null;
  warnings: string[];
  previewBuildMeta: PreviewBuildMeta | null;
};

export type PreviewBuildMeta = {
  installCommand?: string;
  buildCommand?: string;
  packageManager?: string;
  packageRepair?: {
    viteInjected?: boolean;
    pluginReactInjected?: boolean;
    viteConfigCreated?: boolean;
    summary?: string;
    repairs?: string[];
  };
};

export function formatJobAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function previewRuntimeStateLabel(status: PreviewRuntimeStatusPayload): string {
  if (status.previewRenderable) return "Preview ready";
  if (status.jobStatus === "running") return "Preview building";
  if (
    (status.jobStatus === "queued" || status.previewStatus === "queued") &&
    status.workerUnavailable &&
    !status.workerConnected
  ) {
    return status.requiresDeployedWorker ? "Worker not deployed" : "Worker not connected";
  }
  if (status.jobStatus === "queued" || status.previewStatus === "queued") {
    return status.workerConnected ? "Queued — worker connected" : "Preview queued";
  }
  if (status.jobStatus === "failed" || status.previewStatus === "failed") return "Preview failed";
  if (status.workerUnavailable) return "Worker unavailable";
  return "Preview not ready";
}
