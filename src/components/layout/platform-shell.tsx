"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageSquare, Users, LayoutGrid } from "lucide-react";
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
];

function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-border lg:hidden bg-background/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {MOBILE_NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-muted-foreground",
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" />
            )}
            <Icon
              className={cn("size-5 transition-transform", active && "scale-110")}
              strokeWidth={active ? 2 : 1.5}
            />
            <span>{item.label}</span>
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
          className={
            isHomeShellScroll
              ? "relative flex min-h-0 flex-1 min-w-0 flex-col overflow-y-auto overflow-x-hidden"
              : isFullBleed
                ? "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                : "relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-atmosphere px-[var(--page-padding-x)] py-[var(--page-padding-y)]"
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
                  ? "flex h-full min-h-0 min-w-0 flex-col"
                  : "flex min-h-full flex-1 flex-col"
            }
          >
            <div className="flex-1">{children}</div>
            {!isFullBleed && !isOnboarding && <DeferredFooter />}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation — hide while drawer is open */}
      {!mobileOpen && <MobileBottomNav />}
      <DiagnosticsBootstrap />
      <AdminDiagnosticsDrawer />
    </div>
  );
}
