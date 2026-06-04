export type PreviewPhaseInput = {
  state: string;
  renderable: boolean;
  workerConnected: boolean;
  workerUnavailable: boolean;
  workerUnavailableMessage?: string | null;
  blockedReason?: string | null;
  buildLogTail?: string | null;
};

export function previewPhaseHeadline(input: PreviewPhaseInput): string {
  if (input.renderable) return "Preview ready";
  if (input.state === "running") return "Building application…";
  if (input.state === "failed") return "Preview failed";
  if (input.state === "queued") {
    if (input.workerUnavailable && !input.workerConnected) {
      return "Waiting for Preview Runtime Worker";
    }
    return "Preview queued";
  }
  return input.blockedReason ?? "Preview not ready";
}

export function previewPhaseSubline(input: PreviewPhaseInput): string {
  if (input.renderable) return "Your imported app is renderable in the preview frame.";
  if (input.state === "running") return "Installing dependencies and compiling the preview bundle…";
  if (input.state === "queued" && input.workerUnavailable && !input.workerConnected) {
    return (
      input.workerUnavailableMessage ??
      "Start npm run preview-worker:dev locally or deploy worker/preview-worker to Railway."
    );
  }
  if (input.state === "queued") return "Worker connected — your build is in the queue.";
  if (input.state === "failed") return input.blockedReason ?? input.buildLogTail ?? "See build logs for details.";
  return input.blockedReason ?? "Complete import repair steps to enable preview.";
}
