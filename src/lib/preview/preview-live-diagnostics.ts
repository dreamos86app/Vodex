/** Live preview blocker detector — surfaces console, network, and boot audit signals. */

export type PreviewLiveDiagnosticEntry = {
  at: string;
  kind: "console" | "network" | "boot" | "state";
  level: "error" | "warn" | "info";
  message: string;
  detail?: string;
};

export type PreviewLiveDiagnosticsSnapshot = {
  entries: PreviewLiveDiagnosticEntry[];
  errorCount: number;
  warnCount: number;
  networkFailCount: number;
  lastBlocker: string | null;
};

const MAX_ENTRIES = 40;

export function createPreviewLiveDiagnostics(): {
  push: (entry: Omit<PreviewLiveDiagnosticEntry, "at">) => void;
  snapshot: () => PreviewLiveDiagnosticsSnapshot;
  reset: () => void;
  attachWindow: () => () => void;
} {
  const entries: PreviewLiveDiagnosticEntry[] = [];

  function push(entry: Omit<PreviewLiveDiagnosticEntry, "at">) {
    entries.push({ ...entry, at: new Date().toISOString() });
    if (entries.length > MAX_ENTRIES) entries.shift();
  }

  function snapshot(): PreviewLiveDiagnosticsSnapshot {
    const errors = entries.filter((e) => e.level === "error");
    const warns = entries.filter((e) => e.level === "warn");
    const networkFails = entries.filter((e) => e.kind === "network" && e.level === "error");
    const lastBlocker =
      [...entries].reverse().find((e) => e.level === "error")?.message ??
      [...entries].reverse().find((e) => e.level === "warn")?.message ??
      null;
    return {
      entries: [...entries],
      errorCount: errors.length,
      warnCount: warns.length,
      networkFailCount: networkFails.length,
      lastBlocker,
    };
  }

  function reset() {
    entries.length = 0;
  }

  function attachWindow(): () => void {
    if (typeof window === "undefined") return () => undefined;

    const onError = (ev: ErrorEvent) => {
      const src = ev.filename ? `${ev.filename}:${ev.lineno ?? 0}` : "unknown";
      if (!/preview-runtime|preview-html|format=frame/i.test(src) && !/preview/i.test(ev.message ?? "")) {
        return;
      }
      push({
        kind: "console",
        level: "error",
        message: ev.message || "Script error",
        detail: src,
      });
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      const msg = String(ev.reason ?? "unhandled rejection");
      if (!/preview/i.test(msg)) return;
      push({
        kind: "console",
        level: "error",
        message: msg,
      });
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as Record<string, unknown> | null;
      if (!data || data.type !== "vodex-preview-boot-audit") return;
      const phase = String(data.phase ?? "");
      if (phase === "asset-error" || phase === "runtime-error") {
        push({
          kind: "boot",
          level: "error",
          message: String(data.errorMessage ?? data.failedAssetUrl ?? phase),
          detail: phase,
        });
      } else if (phase === "ready") {
        push({ kind: "boot", level: "info", message: "Preview boot ready" });
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("message", onMessage);
    };
  }

  return { push, snapshot, reset, attachWindow };
}
