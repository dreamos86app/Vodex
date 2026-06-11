"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageSquare, Users, LayoutGrid, Settings } from "lucide-react";
import {
  DeferredMobileNav,
  DeferredSidebar,
  DeferredTopBar,
} from "@/components/layout/deferred-shell-chrome";
import { AdminDiagnosticsDrawer } from "@/components/dev/admin-diagnostics-drawer";
import { DiagnosticsBootstrap } from "@/components/dev/diagnostics-bootstrap";
import { PlatformAnnouncementBanners } from "@/components/platform/platform-announcement-banners";
import { DeferredFooter } from "@/components/layout/deferred-footer";
import { RouteScrollToTop } from "@/components/navigation/route-scroll-to-top";
import { cn } from "@/lib/utils";

const pageMeta: Record<string, { title: string; subtitle?: string }> = {
  "/projects": {
    title: "Your Apps",
    subtitle: "Everything you've brought to life — open, remix, or ship.",
  },
  "/templates": {
    title: "Templates",
    subtitle: "Start from a beautiful foundation.",
  },
  "/explore": {
    title: "Explore",
    subtitle: "Discover apps and ideas built by the community.",
  },
  "/chat": {
    title: "AI Chat",
    subtitle: "Talk to the world's best models in one place.",
  },
  "/deploy": {
    title: "Deployment Center",
    subtitle: "Manage environments, domains, and release pipelines.",
  },
  "/marketplace": {
    title: "Marketplace",
    subtitle: "Extensions, plugins, and community components.",
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Usage, credits, and generation insights.",
  },
  "/media": {
    title: "Media & Assets",
    subtitle: "Generated images, uploads, and asset organization.",
  },
  "/community": {
    title: "Community",
    subtitle: "Forums, showcases, and shared knowledge.",
  },
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Jump to apps, create, tokens, and settings.",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Account workspace, keys, and preferences.",
  },
  "/settings/account": {
    title: "Account",
    subtitle: "Profile, security, and personal preferences.",
  },
  "/settings/billing": {
    title: "Billing",
    subtitle: "Subscription, invoices, and payment methods.",
  },
  "/settings/team": {
    title: "Team",
    subtitle: "Members, roles, and collaboration settings.",
  },
  "/settings/models": {
    title: "AI Models",
    subtitle: "Model preferences, routing, and credit usage.",
  },
  "/settings/api-keys": {
    title: "API Keys",
    subtitle: "Manage keys for programmatic access.",
  },
  "/settings/integrations": {
    title: "Integrations",
    subtitle: "Connect GitHub, Vercel, Stripe, and more.",
  },
  "/settings/notifications": {
    title: "Notifications",
    subtitle: "Choose what you hear about and when.",
  },
  "/pricing": {
    title: "Pricing",
    subtitle: "Choose the plan that fits your ambitions.",
  },
  "/credits": {
    title: "Credit usage",
    subtitle: "Real-time tracking of your AI credit spend.",
  },
  "/help": {
    title: "Help Center",
    subtitle: "Guides, docs, and support resources.",
  },
  "/terms": {
    title: "Terms of Service",
    subtitle: "Platform terms and acceptable use.",
  },
  "/privacy": {
    title: "Privacy Policy",
    subtitle: "How we collect and protect your data.",
  },
  "/refunds": {
    title: "Refund Policy",
    subtitle: "Subscriptions, credits, and refunds.",
  },
  "/changelog": {
    title: "Changelog",
    subtitle: "What's new in Vodex.",
  },
  "/admin": {
    title: "Admin Panel",
    subtitle: "Platform management — restricted access.",
  },
  "/onboarding": {
    title: "Welcome to Vodex",
    subtitle: "Let's get you set up.",
  },
};

// ─── Mobile bottom navigation bar ────────────────────────────────────────────

const MOBILE_NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/projects", icon: LayoutGrid, label: "Apps" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/community", icon: Users, label: "Community" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="vodex-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      aria-label="Primary"
    >
      {MOBILE_NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : item.href === "/settings"
              ? pathname === "/settings" || pathname.startsWith("/settings/")
              : item.href === "/chat"
                ? pathname === "/chat" || pathname === "/ai-chat"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
              className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9px] font-medium leading-none transition-colors sm:gap-1 sm:py-2.5 sm:text-[10px]",
              active ? "text-accent" : "text-muted-foreground",
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" />
            )}
            <Icon
              className={cn("size-[18px] shrink-0 sm:size-5", active && "scale-105")}
              strokeWidth={active ? 2 : 1.5}
            />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** CSS-only ambient orbs — avoids framer-motion on critical shell path. */
function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="shell-ambient-orb shell-ambient-orb-violet absolute -right-64 -top-64 size-[700px] rounded-full bg-violet-600/[0.04] blur-[120px]" />
      <div className="shell-ambient-orb shell-ambient-orb-blue absolute -bottom-48 -left-48 size-[600px] rounded-full bg-blue-500/[0.04] blur-[100px]" />
      <div className="shell-ambient-orb shell-ambient-orb-accent absolute left-1/2 top-1/3 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.025] blur-[90px]" />
    </div>
  );
}

export function PlatformShell({
  children,
  homeSessionFromServer = false,
}: {
  children: React.ReactNode;
  /** From server `getUser()` for `/` chrome — avoids client auth hydration flash. */
  homeSessionFromServer?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isCreateHome = pathname === "/" && homeSessionFromServer;
  const isFullBleed =
    isOnboarding ||
    pathname === "/chat" ||
    pathname === "/ai-chat" ||
    pathname.startsWith("/create") ||
    pathname.includes("/builder");
  /** Home scrolls on `main` so the scrollbar sits at the right edge of the content column. */
  const isHomeShellScroll = pathname === "/" && homeSessionFromServer;
  const meta = pageMeta[pathname] ?? { title: "Vodex" };

  /** Marketing landing: no app sidebar (session absent on server for this navigation). */
  const minimalHomeChrome = pathname === "/" && !homeSessionFromServer;

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isOnboarding) {
    return (
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
        <AmbientOrbs />
        <main className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    );
  }

  if (minimalHomeChrome) {
    return (
      <div className="relative flex h-[100dvh] overflow-hidden bg-background">
        <AmbientOrbs />
        <main className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
          <div className="flex w-full min-w-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    );
  }

  return (
    // h-screen + overflow-hidden ensures only the content area scrolls,
    // not the entire page — sidebar and topbar remain perfectly fixed.
    <div className="relative flex h-[100dvh] overflow-hidden bg-background">
      <AmbientOrbs />
      <DeferredSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Right column: topbar + scrollable content */}
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
        <RouteScrollToTop />
        <PlatformAnnouncementBanners />
        <DeferredTopBar
          mode={isCreateHome ? "create" : "standard"}
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setMobileOpen(true)}
        />

        {/* Only this scrolls — sidebar/topbar stay fixed */}
        <main
          data-full-bleed={isFullBleed ? "true" : undefined}
          className={
            isHomeShellScroll
              ? "relative flex min-h-0 flex-1 min-w-0 flex-col overflow-y-auto overflow-x-hidden vodex-scroll-panel vodex-mobile-content-pad lg:pb-0"
              : isFullBleed
                ? "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                : "vodex-shell-main relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-atmosphere px-[var(--page-padding-x)] pt-[var(--page-padding-y)] vodex-scroll-panel vodex-mobile-content-pad lg:pb-0"
          }
          style={
            isHomeShellScroll || !isFullBleed ? { scrollBehavior: "smooth" } : undefined
          }
        >
          {/*
            IMPORTANT: do NOT add `mode="wait"` here, and do NOT add a
            second AnimatePresence inside template.tsx. Two presences keyed
            by pathname produce intermittent white-screens in production
            (React 19 scheduler races the framer-motion exit commit).
            `popLayout` lets the next page mount immediately on top while
            the previous page fades out — never a blank frame.
          */}
          <div
            className={
              isHomeShellScroll
                ? "flex min-h-full w-full min-w-0 flex-col"
                : isFullBleed
                  ? "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  : "flex min-h-full flex-1 flex-col"
            }
          >
            {children}
            {!isFullBleed &&
              !isOnboarding &&
              pathname !== "/projects" &&
              !pathname.startsWith("/projects/") && <DeferredFooter />}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation — hide on full-bleed workspaces and while drawer is open */}
      {!mobileOpen && !isFullBleed && <MobileBottomNav />}
      <DiagnosticsBootstrap />
      <AdminDiagnosticsDrawer />
    </div>
  );
}
