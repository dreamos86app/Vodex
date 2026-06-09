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
  errorCode: string | null;
  userMessage: string | null;
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
  packageRepairDiagnostics: PackageRepairDiagnosticsPayload | null;
  estimatedActionCredits: number | null;
  chargedActionCredits: number | null;
  creditsCharged: boolean;
  chargeStatus: "pending" | "charged" | "refunded" | "cancelled" | "none" | null;
  /** Set when preview succeeded but billing capture failed */
  creditCaptureWarning?: string | null;
  previewFailureKind: string | null;
  previewFailureDetail: string | null;
  previewFailureClassification?: import("@/lib/preview/preview-failure-classifier").PreviewFailureClassification | null;
  previewSource: "worker_job" | "preview_session" | "metadata" | "none";
  generationQualityScore?: number | null;
  sourceIntegrityScore?: number | null;
  previewBuildStatus?: string | null;
};

export type PackageRepairDiagnosticsPayload = {
  executed?: boolean;
  repairChanged?: boolean;
  viteDetectedInOriginal?: boolean;
  viteInjected?: boolean;
  pluginReactInjected?: boolean;
  viteConfigCreated?: boolean;
  packageJsonRelative?: string | null;
  projectRoot?: string | null;
  afterInstall?: {
    binListing?: string[];
    viteBinaryExists?: boolean;
  } | null;
  repairs?: string[];
  summary?: string;
  errorCode?: string | null;
};

export type PreviewBuildMeta = {
  installCommand?: string;
  buildCommand?: string;
  packageManager?: string;
  npmProjectRoot?: string;
  packageJsonRelative?: string | null;
  packageJsonCandidates?: string[];
  frameworkId?: string;
  nodeMaxOldSpaceMb?: number;
  nodeOptions?: string;
  errorCode?: string | null;
  userMessage?: string | null;
  packageRepair?: PackageRepairDiagnosticsPayload;
};

export const VITE_BUILD_OOM_CODE = "VITE_BUILD_OOM";

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
  if (status.errorCode === VITE_BUILD_OOM_CODE || status.blockedReason === "Vite build out of memory") {
    return "Preview build out of memory";
  }
  if (status.jobStatus === "failed" || status.previewStatus === "failed") return "Preview failed";
  if (status.workerUnavailable) return "Worker unavailable";
  if (status.previewFailureKind === "no_preview_job" || status.previewStatus === "not_started") {
    return "Preview needs to be prepared";
  }
  if (status.previewFailureKind === "iframe_blocked") {
    return "Preview embed blocked";
  }
  if (status.previewFailureKind === "no_artifact") {
    return "Preview artifact missing";
  }
  if (status.previewFailureKind && status.previewFailureKind !== "unknown") {
    return "Preview needs repair";
  }
  return "Preview not ready";
}
