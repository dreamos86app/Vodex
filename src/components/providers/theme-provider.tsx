"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * `defaultTheme="system"` together with `enableSystem` is the only
 * combination that lets the next-themes pre-hydration script set the
 * correct `<html>` class before React paints. With `defaultTheme="light"`
 * + system fallback, server renders with no class while client renders
 * with `dark` (or vice versa), causing component-level hydration
 * mismatches.
 *
 * `<html suppressHydrationWarning>` covers the class attribute itself.
 * Components reading `useTheme()` synchronously must guard with
 * `useHydrated()` (see `lib/hooks/use-hydrated.ts`).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="dreamos-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
