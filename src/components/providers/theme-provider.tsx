"use client";

import * as React from "react";

export const DREAMOS_THEME_STORAGE_KEY = "dreamos-theme";

export type DreamOsTheme = "light" | "dark";

type ThemeContextValue = {
  theme: DreamOsTheme | undefined;
  resolvedTheme: DreamOsTheme | undefined;
  setTheme: (theme: DreamOsTheme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: undefined,
  resolvedTheme: undefined,
  setTheme: () => {},
});

function readStoredTheme(): DreamOsTheme {
  try {
    const stored = localStorage.getItem(DREAMOS_THEME_STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyThemeClass(theme: DreamOsTheme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Light by default on first visit; `dreamos-theme` in localStorage wins on return.
 * Blocking init script lives in root `layout.tsx` (server) to avoid FOUC without
 * rendering `<script>` inside this client tree (React 19).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<DreamOsTheme | undefined>(undefined);

  React.useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeClass(stored);
  }, []);

  const setTheme = React.useCallback((next: DreamOsTheme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      localStorage.setItem(DREAMOS_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Drop-in replacement for `useTheme` from next-themes (subset used in this app). */
export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}
