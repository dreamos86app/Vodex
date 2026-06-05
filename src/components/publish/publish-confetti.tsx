"use client";

import * as React from "react";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981"];

export function PublishConfetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = React.useState<
    Array<{ id: number; left: number; delay: number; color: string; rot: number }>
  >([]);

  React.useEffect(() => {
    if (!active) return;
    setPieces(
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        color: COLORS[i % COLORS.length]!,
        rot: Math.random() * 360,
      })),
    );
  }, [active]);

  if (!active || pieces.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[30000] overflow-hidden"
      aria-hidden
      data-testid="publish-confetti"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="publish-confetti-piece absolute top-0 block h-2 w-1.5 rounded-sm opacity-90"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
