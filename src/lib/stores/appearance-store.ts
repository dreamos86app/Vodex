/**
 * DreamOS86 — Appearance Store
 * Persists user preferences for density, motion, and font scale.
 * Theme (dark/light/system) is handled by next-themes.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontScale = "sm" | "md" | "lg";
export type Density = "compact" | "comfortable" | "spacious";

interface AppearanceState {
  fontScale: FontScale;
  density: Density;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;

  setFontScale: (scale: FontScale) => void;
  setDensity: (density: Density) => void;
  setReducedMotion: (reduced: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      fontScale: "md",
      density: "comfortable",
      reducedMotion: false,
      sidebarCollapsed: true,

      setFontScale: (fontScale) => set({ fontScale }),
      setDensity: (density) => set({ density }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: "dreamos-appearance",
    },
  ),
);

// Font scale → CSS variable value
export const FONT_SCALE_MAP: Record<FontScale, string> = {
  sm: "13px",
  md: "14px",
  lg: "15px",
};

// Density → page padding values
export const DENSITY_MAP: Record<Density, { x: string; y: string }> = {
  compact: { x: "1rem", y: "0.75rem" },
  comfortable: { x: "1.5rem", y: "1.25rem" },
  spacious: { x: "2.5rem", y: "2rem" },
};
