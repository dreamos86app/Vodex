import { readRuntimeDiagnostics, type RuntimeDiagnosticEntry } from "@/lib/dev/runtime-diagnostics";

export type OwnerIncidentKind = "error" | "slow" | "api_failure" | "render" | "diagnostic";

export type OwnerIncident = {
  id: string;
  kind: OwnerIncidentKind;
  at: string;
  title: string;
  message?: string;
  stack?: string;
  route?: string;
  meta?: Record<string, unknown>;
};

const MAX = 48;
let incidents: OwnerIncident[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function readOwnerIncidents(): OwnerIncident[] {
  return incidents;
}

export function clearOwnerIncidents(): void {
  incidents = [];
  emit();
}

export function pushOwnerIncident(
  input: Omit<OwnerIncident, "id" | "at"> & { at?: string; id?: string },
): OwnerIncident {
  const entry: OwnerIncident = {
    id: input.id ?? `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
    kind: input.kind,
    title: input.title,
    message: input.message,
    stack: input.stack,
    route: input.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    meta: input.meta,
  };
  incidents = [entry, ...incidents.filter((i) => i.id !== entry.id)].slice(0, MAX);
  emit();
  return entry;
}

export function subscribeOwnerIncidents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function diagnosticToIncident(entry: RuntimeDiagnosticEntry): OwnerIncident | null {
  if (!entry.event.includes("failed") && entry.event !== "error_boundary") return null;
  return {
    id: `diag_${entry.at}_${entry.event}`,
    kind: entry.event === "error_boundary" ? "render" : "diagnostic",
    at: entry.at,
    title: entry.event.replace(/_/g, " "),
    message: entry.detail ? JSON.stringify(entry.detail).slice(0, 1200) : undefined,
    meta: entry.detail,
  };
}

export function syncDiagnosticsToOwnerIncidents(): void {
  for (const entry of readRuntimeDiagnostics().slice(0, 12)) {
    const inc = diagnosticToIncident(entry);
    if (inc && !incidents.some((i) => i.id === inc.id)) {
      incidents = [inc, ...incidents].slice(0, MAX);
    }
  }
  emit();
}

let wired = false;

export function wireOwnerIncidentCapture(): void {
  if (typeof window === "undefined" || wired) return;
  wired = true;

  window.addEventListener("error", (event) => {
    pushOwnerIncident({
      kind: "error",
      title: event.message || "Uncaught error",
      message: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    pushOwnerIncident({
      kind: "api_failure",
      title: "Unhandled promise rejection",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  if ("PerformanceObserver" in window) {
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType !== "navigation") continue;
          const nav = entry as PerformanceNavigationTiming;
          if (nav.loadEventEnd - nav.startTime > 6000) {
            pushOwnerIncident({
              kind: "slow",
              title: "Slow page load",
              message: `load ${Math.round(nav.loadEventEnd - nav.startTime)}ms · ${window.location.pathname}`,
            });
          }
        }
      });
      obs.observe({ type: "navigation", buffered: true });
    } catch {
      /* ignore */
    }
  }
}
