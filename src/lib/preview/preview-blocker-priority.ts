import { VITE_BUILD_OOM_CODE } from "@/lib/preview/preview-runtime-status";

export type PreviewRuntimeFailureInput = {
  workerConnected?: boolean;
  workerUnavailable?: boolean;
  jobStatus?: string | null;
  previewStatus?: string | null;
  previewRenderable?: boolean;
  blockedReason?: string | null;
  errorCode?: string | null;
  userMessage?: string | null;
  requiresDeployedWorker?: boolean;
};

export type AuthoritativePreviewBlocker = {
  priority: number;
  code: string;
  title: string;
  summary: string;
  fixHint: string;
  details?: string;
};

const KNOWN_BUILD_CODES = new Set([
  VITE_BUILD_OOM_CODE,
  "VITE_BINARY_MISSING_AFTER_INSTALL",
  "PREVIEW_WORKER_MEMORY_TOO_LOW",
  "PACKAGE_JSON_NOT_FOUND",
  "INSTALL_FAILED",
  "BASE44_SHIM_FAILED",
]);

function isWorkerBuildFailure(input: PreviewRuntimeFailureInput): boolean {
  if (input.previewRenderable) return false;
  const code = input.errorCode ?? "";
  if (KNOWN_BUILD_CODES.has(code)) return true;
  const reason = (input.blockedReason ?? "").toLowerCase();
  if (reason.includes("vite build out of memory")) return true;
  if (reason.includes("vite:") && reason.includes("not found")) return true;
  if (reason.includes("dependency install failed")) return true;
  if (input.jobStatus === "failed" && reason.length > 0) return true;
  return false;
}

/** Deterministic preview failure message — worker/runtime errors beat thin-file warnings. */
export function resolveAuthoritativePreviewBlocker(
  input: PreviewRuntimeFailureInput,
): AuthoritativePreviewBlocker | null {
  if (input.previewRenderable) return null;

  if (input.requiresDeployedWorker && input.workerUnavailable && !input.workerConnected) {
    return {
      priority: 1,
      code: "WORKER_NOT_CONNECTED",
      title: "Preview worker not connected",
      summary:
        input.userMessage ??
        "Deploy or start the preview worker before ZIP and framework previews can build.",
      fixHint: "Start npm run preview-worker:dev locally or deploy worker/preview-worker on Railway.",
    };
  }

  if (input.jobStatus === "queued" || input.jobStatus === "running" || input.previewStatus === "queued") {
    return {
      priority: 2,
      code: "PREVIEW_BUILDING",
      title: "Preview build in progress",
      summary: "The dedicated preview worker is installing dependencies and building your app.",
      fixHint: "Wait for the build to finish — check the preview runtime panel for queue age and logs.",
    };
  }

  const code = input.errorCode ?? "";
  const reason = input.blockedReason ?? "";

  if (code === VITE_BUILD_OOM_CODE || reason === "Vite build out of memory") {
    return {
      priority: 3,
      code: VITE_BUILD_OOM_CODE,
      title: "Preview build out of memory",
      summary:
        input.userMessage ??
        "This imported app is too large for the current preview worker memory. Increase worker memory or reduce bundle size.",
      fixHint: "Upgrade Railway worker memory to 2–4GB or lower PREVIEW_NODE_MAX_OLD_SPACE_MB to fit the container.",
    };
  }

  if (code === "VITE_BINARY_MISSING_AFTER_INSTALL" || reason.includes("VITE_BINARY_MISSING")) {
    return {
      priority: 3,
      code: "VITE_BINARY_MISSING_AFTER_INSTALL",
      title: "Vite not installed in preview build",
      summary: "Dependencies installed but the Vite CLI binary is missing from node_modules.",
      fixHint: "Re-import with devDependencies included or rebuild after package repair completes.",
    };
  }

  if (code === "PREVIEW_WORKER_MEMORY_TOO_LOW") {
    return {
      priority: 3,
      code,
      title: "Preview worker memory too low",
      summary:
        input.userMessage ??
        "The preview worker container does not have enough RAM for the configured Node heap.",
      fixHint: "Increase Railway service memory or lower PREVIEW_NODE_MAX_OLD_SPACE_MB.",
    };
  }

  if (reason && input.jobStatus === "failed") {
    const title =
      code === "compile_error" || reason.includes("typescript")
        ? "Preview build failed — TypeScript"
        : code === "invalid_import" || reason.includes("import")
          ? "Preview build failed — missing import"
          : reason === "Vite build failed" || reason.toLowerCase().includes("vite")
            ? "Preview build failed — Vite"
            : "Preview build failed";
    return {
      priority: 3,
      code: code || "PREVIEW_BUILD_FAILED",
      title,
      summary: input.userMessage ?? reason,
      fixHint: "Run automatic repair or open build logs and fix the reported compile error.",
      details: reason,
    };
  }

  return null;
}

export function shouldSuppressThinFileBlocker(input: PreviewRuntimeFailureInput): boolean {
  return isWorkerBuildFailure(input);
}
