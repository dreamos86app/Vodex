"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const PORTAL_ROOT_ID = "vodex-portal-root";

/** Returns the shared portal mount node (creates on demand). */
export function getPortalContainer(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getPortalContainer called during SSR");
  }
  let root = document.getElementById(PORTAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PORTAL_ROOT_ID;
    root.setAttribute("data-vodex-portal-root", "true");
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "var(--z-portal-root, 900)";
    root.style.pointerEvents = "none";
    root.style.isolation = "isolate";
    document.body.appendChild(root);
  }
  return root;
}

type PortalProps = {
  children: React.ReactNode;
  /** Optional layer label for debugging / audit. */
  layer?: string;
};

/** Renders children into document.body via the shared portal root. */
export function Portal({ children, layer }: PortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div data-vodex-overlay-layer={layer ?? "unknown"}>{children}</div>,
    getPortalContainer(),
  );
}
