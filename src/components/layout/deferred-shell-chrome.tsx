"use client";

import dynamic from "next/dynamic";
import { useIdleReady } from "@/lib/hooks/use-idle-ready";
import { cn } from "@/lib/utils";

const Sidebar = dynamic(
  () => import("@/components/layout/sidebar").then((m) => m.Sidebar),
  { ssr: false, loading: () => null },
);

const TopBar = dynamic(
  () => import("@/components/layout/top-bar").then((m) => m.TopBar),
  { ssr: false, loading: () => <TopBarSkeleton /> },
);

function TopBarSkeleton() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 sm:px-5">
      <div className="size-9 rounded-lg bg-muted/40 lg:hidden" />
      <div className="hidden min-w-0 flex-1 lg:block">
        <div className="h-4 w-32 rounded-md bg-muted/50" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden h-8 w-24 rounded-lg bg-muted/40 md:block" />
        <div className="size-8 rounded-full bg-muted/50" />
      </div>
    </header>
  );
}

export function DeferredSidebar(props: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const ready = useIdleReady(80);
  if (!ready) return null;
  return <Sidebar mobileOpen={props.mobileOpen} onMobileClose={props.onMobileClose} />;
}

export function DeferredTopBar(props: {
  mode: "create" | "standard";
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}) {
  const ready = useIdleReady(40);
  if (!ready) return <TopBarSkeleton />;
  return <TopBar {...props} />;
}

export function DeferredMobileNav(props: { className?: string; children: React.ReactNode }) {
  const ready = useIdleReady(100);
  return (
    <nav
      className={cn(props.className, !ready && "opacity-0")}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-hidden={!ready}
    >
      {ready ? props.children : null}
    </nav>
  );
}
