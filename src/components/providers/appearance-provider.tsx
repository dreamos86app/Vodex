"use client";

import * as React from "react";
import {
  useAppearanceStore,
  FONT_SCALE_MAP,
  DENSITY_MAP,
} from "@/lib/stores/appearance-store";

/**
 * Applies persisted appearance preferences as CSS variables on <html>.
 * Must render after Zustand hydration so SSR matches first paint.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { fontScale, density, reducedMotion } = useAppearanceStore();

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--font-size-base", FONT_SCALE_MAP[fontScale]);
    const d = DENSITY_MAP[density];
    root.style.setProperty("--page-padding-x", d.x);
    root.style.setProperty("--page-padding-y", d.y);

    if (reducedMotion) {
      root.classList.add("reduce-motion");
    } else {
      root.classList.remove("reduce-motion");
    }
  }, [fontScale, density, reducedMotion]);

  return <>{children}</>;
}
