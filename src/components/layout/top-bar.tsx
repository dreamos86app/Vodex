"use client";

import Link from "next/link";
import { Menu, Bell, Search } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { IconButton } from "@/components/ui/icon-button";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { useCommandCenter } from "@/components/command/command-center";

type TopBarProps = {
  mode: "create" | "standard";
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
};

export function TopBar({ mode, title, subtitle, onMenuClick }: TopBarProps) {
  const isCreate = mode === "create";
  useAuthStore(); // profile available via UserMenu
  const { unreadCount } = useNotificationsStore();
  const { openCommandCenter } = useCommandCenter();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 backdrop-blur-xl sm:px-5",
        isCreate
          ? "border-b border-transparent bg-background/40"
          : "border-b border-border bg-background/70",
      )}
    >
      <IconButton
        label="Open navigation"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="size-[18px]" strokeWidth={1.65} />
      </IconButton>

      {!isCreate ? (
        <div className="min-w-0 flex-1 lg:flex-none">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.03em] text-foreground sm:text-[16px]">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-[12px] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      ) : (
        <div className="hidden flex-1 lg:block" />
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {/* Cmd+K command center trigger */}
        <button
          type="button"
          onClick={openCommandCenter}
          className="hidden items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-[12px] text-muted-foreground ring-1 ring-border transition hover:bg-surface-raised hover:text-foreground md:flex"
          aria-label="Open command center"
        >
          <Search className="size-3.5" strokeWidth={1.75} />
          <span>Search…</span>
          <kbd className="rounded bg-background/60 px-1 py-0.5 text-[10px] font-mono ring-1 ring-border/60">⌘K</kbd>
        </button>

        <ThemeToggle />

        {/* Notifications — real unread count */}
        <Link
          href="/settings/notifications"
          className="relative inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition hover:bg-surface hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-[17px]" strokeWidth={1.55} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent ring-2 ring-background" />
          )}
        </Link>

        <div className="hidden h-7 w-px bg-border sm:block" />

        {/* User account dropdown */}
        <UserMenu />
      </div>
    </header>
  );
}
