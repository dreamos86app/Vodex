"use client";

import * as React from "react";

type Star = {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  blue: boolean;
  opacity: number;
};

function makeStars(count: number, seed: number): Star[] {
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: rand() * 100,
    size: 1 + rand() * 2.5,
    delay: rand() * 4,
    duration: 2.2 + rand() * 2.8,
    blue: rand() > 0.45,
    opacity: 0.35 + rand() * 0.65,
  }));
}

export function IntroFallingStars({ active }: { active: boolean }) {
  const stars = React.useMemo(() => {
    const seed =
      typeof window !== "undefined"
        ? (Date.now() % 100000) + Math.floor(Math.random() * 9999)
        : 42;
    return makeStars(48, seed);
  }, []);

  if (!active) return null;

  return (
    <div className="vodex-intro-v2__stars pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.map((star) => (
        <span
          key={star.id}
          className={`vodex-intro-v2__star ${star.blue ? "vodex-intro-v2__star--blue" : "vodex-intro-v2__star--white"}`}
          style={{
            left: `${star.left}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
