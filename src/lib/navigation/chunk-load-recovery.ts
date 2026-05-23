/** Detect Next/webpack chunk load failures (stale deploy, dev compile timeout). */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|timeout.*\/_next\/static\/chunks/i.test(
    msg,
  );
}

const RELOAD_KEY = "dreamos-chunk-reload-once";

/** Reload once per session when a chunk fails — avoids infinite refresh loops. */
export function safeChunkReloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function installChunkLoadRecovery(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    if (isChunkLoadError(event.error ?? event.message)) {
      console.warn("[dreamos] Chunk load error detected");
    }
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event.reason)) {
      console.warn("[dreamos] Chunk load promise rejection");
    }
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
