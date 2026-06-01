"use client";

import dynamic from "next/dynamic";
import { AppProvider } from "@/components/providers/app-provider";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { VodexSessionIntroGate } from "@/components/session/vodex-session-intro-gate";
import { Toaster } from "@/components/ui/toaster";

const AppChromeExtras = dynamic(
  () =>
    import("@/components/providers/app-chrome-extras").then((m) => m.AppChromeExtras),
  { ssr: false },
);

/** Full authenticated app shell providers — not used on /auth or static marketing pages. */
export function AppChromeProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppearanceProvider>
        <AppChromeExtras />
        <VodexSessionIntroGate>{children}</VodexSessionIntroGate>
        <Toaster />
      </AppearanceProvider>
    </AppProvider>
  );
}
