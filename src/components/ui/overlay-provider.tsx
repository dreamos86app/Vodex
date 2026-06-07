"use client";

import * as React from "react";
import type { OverlayLayerKey } from "@/components/ui/overlay-layers";

type OverlayEntry = {
  id: string;
  layer: OverlayLayerKey;
  onEscape?: () => void;
  lockScroll?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

type OverlayContextValue = {
  register: (entry: OverlayEntry) => void;
  unregister: (id: string) => void;
};

const OverlayContext = React.createContext<OverlayContextValue | null>(null);

let overlayIdCounter = 0;

function nextOverlayId(): string {
  overlayIdCounter += 1;
  return `overlay-${overlayIdCounter}`;
}

/** Global overlay stack — ESC closes top-most; dialogs lock body scroll. */
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const stackRef = React.useRef<OverlayEntry[]>([]);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  const register = React.useCallback((entry: OverlayEntry) => {
    stackRef.current = [...stackRef.current.filter((e) => e.id !== entry.id), entry];
    bump();
  }, []);

  const unregister = React.useCallback((id: string) => {
    const next = stackRef.current.filter((e) => e.id !== id);
    if (next.length !== stackRef.current.length) {
      stackRef.current = next;
      bump();
    }
  }, []);

  const lockScroll = stackRef.current.some((e) => e.lockScroll);

  React.useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = stackRef.current[stackRef.current.length - 1];
      if (!top?.onEscape) return;
      e.preventDefault();
      e.stopPropagation();
      top.onEscape();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <OverlayContext.Provider value={{ register, unregister }}>{children}</OverlayContext.Provider>
  );
}

export function useOverlayStack() {
  const ctx = React.useContext(OverlayContext);
  if (!ctx) {
    throw new Error("useOverlayStack must be used within OverlayProvider");
  }
  return ctx;
}

/** Register an overlay while `open` — handles ESC + scroll lock + focus return. */
export function useRegisterOverlay(input: {
  open: boolean;
  layer: OverlayLayerKey;
  onEscape?: () => void;
  lockScroll?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const { register, unregister } = useOverlayStack();
  const idRef = React.useRef<string | null>(null);

  if (!idRef.current) idRef.current = nextOverlayId();

  React.useEffect(() => {
    const id = idRef.current!;
    if (!input.open) {
      unregister(id);
      return;
    }
    register({
      id,
      layer: input.layer,
      onEscape: input.onEscape,
      lockScroll: input.lockScroll,
      returnFocusRef: input.returnFocusRef,
    });
    return () => unregister(id);
  }, [input.open, input.layer, input.onEscape, input.lockScroll, input.returnFocusRef, register, unregister]);

  React.useEffect(() => {
    if (input.open || !input.returnFocusRef?.current) return;
    const el = input.returnFocusRef.current;
    const t = window.setTimeout(() => el.focus(), 0);
    return () => window.clearTimeout(t);
  }, [input.open, input.returnFocusRef]);
}
