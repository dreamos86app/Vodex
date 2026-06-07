"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Sparkles,
  LayoutGrid,
  Compass,
  Rocket,
  Store,
  BarChart3,
  Users,
  Settings2,
  HelpCircle,
  ScrollText,
  Gift,
  MessageSquare,
  ArrowRight,
  Zap,
  Globe,
  Key,
  CreditCard,
  Moon,
  Sun,
  LogOut,
  Building,
  Plus,
} from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { runFullSignOut } from "@/lib/auth/sign-out-client";
import { DreamTemplatesNavIcon } from "@/components/ui/dream-templates-nav-icon";
import { matchCommands, SITE_COMMANDS, appCommandDef, type SiteCommandDef } from "@/lib/navigation/site-command-index";
import { getRecentPages } from "@/lib/navigation/recent-pages";

// ─── Command item types ───────────────────────────────────────────────────────

type CommandGroup = {
  label: string;
  items: CommandItem[];
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
};

// ─── Command Center hook ──────────────────────────────────────────────────────

type CommandCenterState = {
  open: boolean;
  openCommandCenter: () => void;
  closeCommandCenter: () => void;
  toggleCommandCenter: () => void;
};

// Singleton event bus for Cmd+K
const listeners = new Set<(open: boolean) => void>();
let _open = false;

function notifyListeners(open: boolean) {
  _open = open;
  for (const l of listeners) l(open);
}

export function useCommandCenter(): CommandCenterState {
  const [open, setOpen] = React.useState(_open);

  React.useEffect(() => {
    listeners.add(setOpen);
    return () => { listeners.delete(setOpen); };
  }, []);

  return {
    open,
    openCommandCenter: () => notifyListeners(true),
    closeCommandCenter: () => notifyListeners(false),
    toggleCommandCenter: () => notifyListeners(!_open),
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandCenter() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  // Subscribe to singleton
  React.useEffect(() => {
    listeners.add(setOpen);
    return () => { listeners.delete(setOpen); };
  }, []);

  // Global Cmd+K / Ctrl+K listener
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        notifyListeners(!_open);
      }
      if (e.key === "Escape" && _open) {
        notifyListeners(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const [apps, setApps] = React.useState<Array<{ id: string; name: string }>>([]);
  const [recentTick, setRecentTick] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setRecentTick((t) => t + 1);
    void fetch("/api/projects", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { projects?: Array<{ id: string; name: string }> } | null) => {
        setApps((data?.projects ?? []).slice(0, 40));
      })
      .catch(() => setApps([]));
  }, [open]);

  function navigate(path: string) {
    notifyListeners(false);
    router.push(path);
  }

  function toCommandItem(cmd: SiteCommandDef): CommandItem {
    return {
      id: cmd.id,
      label: cmd.label,
      description: cmd.breadcrumb,
      icon: cmd.icon,
      action: () => navigate(cmd.href),
      keywords: [...cmd.keywords, cmd.category.toLowerCase(), cmd.breadcrumb.toLowerCase()],
    };
  }

  const groups: CommandGroup[] = React.useMemo(() => {
    const q = query.trim();
    if (!q) {
      const recent = getRecentPages(6);
      const recentItems: CommandItem[] = recent.map((r) => ({
        id: `recent-${r.id}`,
        label: r.label,
        description: r.breadcrumb,
        icon: r.category === "Apps" ? Building : r.category === "Keys" ? Key : Sparkles,
        action: () => navigate(r.href),
        keywords: [r.category.toLowerCase()],
      }));

      const actionItems: CommandItem[] = [
        {
          id: "theme",
          label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
          description: "Appearance",
          icon: resolvedTheme === "dark" ? Sun : Moon,
          action: () => {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
            notifyListeners(false);
          },
          keywords: ["theme", "dark", "light"],
        },
        {
          id: "logout",
          label: "Sign out",
          description: "Account",
          icon: LogOut,
          action: () => {
            notifyListeners(false);
            void runFullSignOut();
          },
          keywords: ["logout"],
        },
      ];

      const byCategory = new Map<string, CommandItem[]>();
      for (const cmd of SITE_COMMANDS) {
        const item = toCommandItem(cmd);
        const list = byCategory.get(cmd.category) ?? [];
        list.push(item);
        byCategory.set(cmd.category, list);
      }
      for (const app of apps.slice(0, 12)) {
        const item = toCommandItem(appCommandDef(app));
        const list = byCategory.get("Apps") ?? [];
        list.push(item);
        byCategory.set("Apps", list);
      }

      const out: CommandGroup[] = [];
      if (recentItems.length) out.push({ label: "Recent", items: recentItems });
      out.push({ label: "Actions", items: actionItems });
      for (const [label, items] of byCategory) {
        out.push({ label, items });
      }
      return out;
    }

    const matched = matchCommands(q, apps).map(toCommandItem);
    const byCategory = new Map<string, CommandItem[]>();
    for (const item of matched) {
      const cmd = [...SITE_COMMANDS, ...apps.map(appCommandDef)].find((c) => c.id === item.id);
      const cat = cmd?.category ?? "Results";
      const list = byCategory.get(cat) ?? [];
      list.push(item);
      byCategory.set(cat, list);
    }
    return Array.from(byCategory.entries()).map(([label, items]) => ({ label, items }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, resolvedTheme, apps, recentTick]);

  // Flat list for keyboard navigation
  const flatItems = React.useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatItems[selectedIdx]?.action();
    }
  }

  // Reset selection when query changes
  React.useEffect(() => { setSelectedIdx(0); }, [query]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[var(--z-command-palette)] bg-black/50 backdrop-blur-[2px]"
            onClick={() => notifyListeners(false)}
          />

          {/* Panel */}
          <div className="fixed inset-x-0 top-[20vh] z-[var(--z-command-palette)] flex justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[580px] overflow-hidden rounded-2xl bg-background shadow-[0_24px_64px_-12px_rgba(0,0,0,0.4)] ring-1 ring-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search commands, pages, settings…"
                  className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
                <kbd className="hidden rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground ring-1 ring-border sm:inline">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[420px] overflow-y-auto py-2 scrollbar-none">
                {groups.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  groups.map((group) => (
                    <div key={group.label}>
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const globalIdx = flatItems.indexOf(item);
                        const selected = selectedIdx === globalIdx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={item.action}
                            onMouseEnter={() => setSelectedIdx(globalIdx)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2 text-left transition",
                              selected ? "bg-accent/8" : "hover:bg-surface/50",
                            )}
                          >
                            <div className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-lg transition",
                              selected ? "bg-accent/15 text-accent" : "bg-surface text-muted-foreground",
                            )}>
                              <Icon
                                className="size-3.5"
                                {...(item.id === "templates" ? {} : { strokeWidth: 1.75 })}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "truncate text-[13px] font-medium",
                                  selected ? "text-foreground" : "text-foreground/80",
                                )}>
                                  {item.label}
                                </p>
                                {group.label !== "Recent" && group.label !== "Actions" ? (
                                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {group.label}
                                  </span>
                                ) : null}
                              </div>
                              {item.description && (
                                <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                              )}
                            </div>
                            {item.shortcut && (
                              <kbd className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground ring-1 ring-border">
                                {item.shortcut}
                              </kbd>
                            )}
                            {selected && (
                              <ArrowRight className="size-3.5 shrink-0 text-accent/60" strokeWidth={2} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-3 border-t border-border px-4 py-2">
                <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/50">
                  <kbd className="rounded bg-surface px-1 py-0.5 font-mono ring-1 ring-border">↑↓</kbd>
                  navigate
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/50">
                  <kbd className="rounded bg-surface px-1 py-0.5 font-mono ring-1 ring-border">↵</kbd>
                  select
                </div>
                <div className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground/40">
                  <Zap className="size-3 text-accent/50" strokeWidth={1.75} />
                  Vodex
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
