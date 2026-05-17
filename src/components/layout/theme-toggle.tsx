"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "@/components/ui/icon-button";
import { useHydrated } from "@/lib/hooks/use-hydrated";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <IconButton label="Theme" className={className} disabled>
        <Moon className="size-[18px]" strokeWidth={1.65} />
      </IconButton>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <IconButton
      label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="size-[18px]" strokeWidth={1.65} />
      ) : (
        <Moon className="size-[18px]" strokeWidth={1.65} />
      )}
    </IconButton>
  );
}
