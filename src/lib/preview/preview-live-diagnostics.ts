import { isIgnorablePreviewAssetLoadFailure } from "@/lib/preview/preview-boot-audit-types";

/** Live preview blocker detector — surfaces console, network, and boot audit signals. */

export type PreviewLiveDiagnosticEntry = {
  at: string;
  kind: "console" | "network" | "boot" | "state" | "auth";
  level: "error" | "warn" | "info";
  message: string;
  detail?: string;
  rootCause?: string;
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
      const msg = ev.message || "Script error";
      const src = ev.filename ? `${ev.filename}:${ev.lineno ?? 0}` : "unknown";
      const stack = ev.error && typeof ev.error === "object" && "stack" in ev.error ? String(ev.error.stack) : undefined;
      if (!/preview-runtime|preview-html|format=frame/i.test(src) && !/preview|oauth|auth|google|ripo/i.test(msg)) {
        return;
      }
      push({
        kind: "console",
        level: "error",
        message: msg,
        detail: stack ? `${src}\n${stack.slice(0, 280)}` : src,
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
      if (phase === "asset-error") {
        const url = String(data.failedAssetUrl ?? "");
        if (isIgnorablePreviewAssetLoadFailure(url, String(data.failedAssetTag ?? ""))) return;
        push({ kind: "boot", level: "error", message: url || phase, detail: phase });
      } else if (phase === "runtime-error") {
        push({
          kind: "boot",
          level: "error",
          message: String(data.errorMessage ?? phase),
          detail: phase,
        });
      } else if (phase === "auth-stuck") {
        push({
          kind: "auth",
          level: "warn",
          message: String(data.authStuckReason ?? "Stuck on Google sign-in"),
          detail: typeof data.bodySnippet === "string" ? data.bodySnippet : undefined,
          rootCause:
            "Base44/Google OAuth cannot complete inside preview iframe — must use Vodex /login page",
        });
      } else if (phase === "auth-redirect") {
        push({
          kind: "auth",
          level: "info",
          message: `Redirecting to Vodex login: ${String(data.navigationUrl ?? "/login")}`,
        });
      } else if (phase === "base44-ui-detected") {
        push({
          kind: "auth",
          level: "warn",
          message: String(data.base44UiReason ?? "Base44 default welcome UI detected"),
          detail: typeof data.bodySnippet === "string" ? data.bodySnippet : undefined,
          rootCause:
            typeof data.suggestedFix === "string"
              ? data.suggestedFix
              : "SPA mounted before Vodex auth gate — use preview-runtime /login mount URL",
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
