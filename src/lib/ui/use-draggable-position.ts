"use client";

import * as React from "react";

export type DraggablePosition = { x: number; y: number };

const LEFT_SNAP_X = 20;
const MAGNET_PX = 64;
const MAX_LEFT_X = 148;

function clampPosition(next: DraggablePosition, elWidth = 120, elHeight = 40): DraggablePosition {
  if (typeof window === "undefined") return next;
  const maxY = Math.max(56, window.innerHeight - elHeight - 24);
  const maxX = Math.min(MAX_LEFT_X, window.innerWidth - elWidth - 16);
  let x = Math.min(maxX, Math.max(8, next.x));
  let y = Math.min(maxY, Math.max(48, next.y));
  if (x < MAGNET_PX) x = LEFT_SNAP_X;
  return { x, y };
}

export function useDraggablePosition(storageKey: string, defaultPos: DraggablePosition) {
  const [pos, setPos] = React.useState<DraggablePosition>(() =>
    clampPosition(defaultPos),
  );
  const dragRef = React.useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraggablePosition;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        setPos(clampPosition(parsed));
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const persist = React.useCallback(
    (next: DraggablePosition) => {
      const clamped = clampPosition(next);
      setPos(clamped);
      try {
        localStorage.setItem(storageKey, JSON.stringify(clamped));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
    },
    [pos.x, pos.y],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      persist({
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
      });
    },
    [persist],
  );

  const onPointerUp = React.useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    persist(pos);
  }, [persist, pos]);

  React.useEffect(() => {
    const onResize = () => setPos((p) => clampPosition(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    pos,
    style: { left: pos.x, top: pos.y } as React.CSSProperties,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
