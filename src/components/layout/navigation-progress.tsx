"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { markNavigationComplete, markNavigationStart } from "@/lib/navigation/route-perf";

/** Top progress bar — starts on link click, completes on route render. */
export function NavigationProgress() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const prev = useRef(pathname);
  const stallRef = useRef<number | null>(null);

  const startBar = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.width = "0%";
    el.style.opacity = "1";
    requestAnimationFrame(() => {
      el.style.width = "65%";
    });
    if (stallRef.current) window.clearTimeout(stallRef.current);
    stallRef.current = window.setTimeout(() => {
      if (barRef.current) barRef.current.style.width = "85%";
    }, 800);
  }, []);

  const finishBar = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    if (stallRef.current) window.clearTimeout(stallRef.current);
    el.style.width = "100%";
    window.setTimeout(() => {
      el.style.opacity = "0";
      el.style.width = "0%";
    }, 180);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || anchor.target === "_blank") return;
      markNavigationStart(href);
      startBar();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [startBar]);

  useEffect(() => {
    if (prev.current !== pathname) {
      markNavigationComplete(pathname);
      finishBar();
      prev.current = pathname;
    }
  }, [pathname, finishBar]);

  useEffect(() => () => {
    if (stallRef.current) window.clearTimeout(stallRef.current);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[10050] h-0.5 bg-transparent">
      <div
        ref={barRef}
        data-testid="navigation-progress"
        className="h-full bg-accent transition-[width,opacity] duration-300 ease-out shadow-[0_0_8px_hsl(var(--accent)/0.5)]"
        style={{ width: "0%", opacity: 0 }}
      />
    </div>
  );
}
