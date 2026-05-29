"use client";

import * as React from "react";

export type ComposerReadinessReason =
  | "shell_missing"
  | "textarea_missing"
  | "textarea_disabled"
  | "textarea_not_visible"
  | "submit_missing"
  | "debug_attrs_missing"
  | "handlers_not_ready"
  | "ready";

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}

/** Composer may sit in a pre-hydration layer (opacity 0) — still interactive for E2E. */
function isComposerSurfaceVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function findComposerTextarea(): HTMLTextAreaElement | null {
  const candidates = [
    document.querySelector('[data-testid="workspace-composer-textarea"]'),
    document.getElementById("dreamos-composer-prompt"),
    document.querySelector('[data-testid="create-prompt-textarea"]'),
    document.getElementById("dreamos-composer-prompt-fallback"),
  ];
  for (const node of candidates) {
    if (node instanceof HTMLTextAreaElement && isComposerSurfaceVisible(node)) return node;
  }
  for (const node of candidates) {
    if (node instanceof HTMLTextAreaElement) return node;
  }
  return null;
}

function findComposerSubmit(): HTMLButtonElement | null {
  const candidates = [
    document.querySelector('[data-testid="workspace-composer-submit"]'),
    document.querySelector('[data-testid="create-submit-button"]'),
    document.querySelector("[data-create-build-btn]"),
  ];
  for (const node of candidates) {
    if (node instanceof HTMLButtonElement && isVisible(node)) return node;
  }
  for (const node of candidates) {
    if (node instanceof HTMLButtonElement) return node;
  }
  return null;
}

export function evaluateComposerReadiness(): {
  ready: boolean;
  reason: ComposerReadinessReason;
} {
  if (typeof document === "undefined") {
    return { ready: false, reason: "shell_missing" };
  }

  const shell =
    document.querySelector('[data-testid="builder-shell"]:not([data-create-server-shell="true"])') ??
    document.querySelector('[data-testid="create-workspace-layer"]') ??
    document.querySelector('[data-testid="create-page-root"]') ??
    document.querySelector('[data-testid="builder-shell"]') ??
    document.querySelector('[data-create-server-shell="true"]');
  if (!shell) return { ready: false, reason: "shell_missing" };

  const ta = findComposerTextarea();
  if (!ta) return { ready: false, reason: "textarea_missing" };

  if (!isComposerSurfaceVisible(ta)) {
    return { ready: false, reason: "textarea_not_visible" };
  }

  if (ta.disabled || ta.getAttribute("aria-disabled") === "true") {
    return { ready: false, reason: "textarea_disabled" };
  }

  const btn = findComposerSubmit();
  if (!btn) return { ready: false, reason: "submit_missing" };

  for (const attr of [
    "data-disabled-reason",
    "data-dom-len",
    "data-state-len",
    "data-live-len",
  ] as const) {
    if (!btn.hasAttribute(attr)) {
      return { ready: false, reason: "debug_attrs_missing" };
    }
  }

  if (ta.getAttribute("data-composer-handlers") !== "true") {
    return { ready: false, reason: "handlers_not_ready" };
  }

  return { ready: true, reason: "ready" };
}

/**
 * Live DOM probe + sr-only marker for E2E. Mounted outside nested Suspense on /create.
 */
export function CreateComposerReadyBridge() {
  const [state, setState] = React.useState<{ ready: boolean; reason: ComposerReadinessReason }>({
    ready: false,
    reason: "shell_missing",
  });

  React.useEffect(() => {
    const tick = () => {
      const next = evaluateComposerReadiness();
      setState((prev) =>
        prev.ready === next.ready && prev.reason === next.reason ? prev : next,
      );
    };

    tick();
    const interval = window.setInterval(tick, 40);
    const observer = new MutationObserver(tick);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("dreamos:composer-sync", tick);

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener("dreamos:composer-sync", tick);
    };
  }, []);

  return (
    <div
      data-testid="create-composer-ready"
      data-ready={state.ready ? "true" : "false"}
      data-reason={state.reason}
      className="sr-only"
      aria-hidden
    />
  );
}
