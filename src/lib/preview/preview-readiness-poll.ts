export const PREVIEW_POLL_MAX_ATTEMPTS = 24;
export const PREVIEW_POLL_INTERVAL_MS = 2_500;
export const PREVIEW_POLL_TIMEOUT_MS = PREVIEW_POLL_MAX_ATTEMPTS * PREVIEW_POLL_INTERVAL_MS;

export type CanonicalPreviewState =
  | "not_requested"
  | "pending"
  | "warming"
  | "renderable"
  | "failed"
  | "timeout";

export function previewStateFromPoll(input: {
  previewRenderable: boolean;
  sourceIntegrityOk?: boolean;
  error?: string | null;
  attempts: number;
  maxAttempts?: number;
}): CanonicalPreviewState {
  const max = input.maxAttempts ?? PREVIEW_POLL_MAX_ATTEMPTS;
  if (input.previewRenderable && input.sourceIntegrityOk !== false) return "renderable";
  if (input.error) return "failed";
  if (input.attempts >= max) return "timeout";
  if (input.attempts > 0) return "warming";
  return "pending";
}

export function userMessageForPreviewState(state: CanonicalPreviewState, hasFiles: boolean): string {
  switch (state) {
    case "renderable":
      return "Preview is ready";
    case "warming":
    case "pending":
      return hasFiles ? "Build saved — preview is still preparing" : "Preparing preview";
    case "timeout":
      return "Preview is taking longer than expected. Files are saved. You can retry preview or repair.";
    case "failed":
      return "Preview could not render yet";
    default:
      return "Preview not started";
  }
}
