"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

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
  "/settings": {
    title: "Settings",
    subtitle: "Workspace, keys, and preferences.",
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
    subtitle: "Model preferences, routing, and credit impact.",
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
    title: "Credits Usage",
    subtitle: "Real-time tracking of your AI spend.",
  },
  "/help": {
    title: "Help Center",
    subtitle: "Guides, docs, and support resources.",
  },
  "/changelog": {
    title: "Changelog",
    subtitle: "What's new in DreamOS86.",
  },
  "/onboarding": {
    title: "Welcome to DreamOS86",
    subtitle: "Let's get you set up.",
  },
};

// Ambient background orbs — ultra subtle, alive but not distracting
function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Primary violet orb — top right */}
      <motion.div
        className="absolute -right-64 -top-64 size-[700px] rounded-full bg-violet-600/[0.04] blur-[120px]"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.08, 0.97, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Blue orb — bottom left */}
      <motion.div
        className="absolute -bottom-48 -left-48 size-[600px] rounded-full bg-blue-500/[0.04] blur-[100px]"
        animate={{
          x: [0, -25, 35, 0],
          y: [0, 20, -15, 0],
          scale: [1, 0.95, 1.05, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
      {/* Accent orb — center */}
      <motion.div
        className="absolute left-1/2 top-1/3 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.025] blur-[90px]"
        animate={{
          scale: [1, 1.12, 0.94, 1],
          opacity: [0.6, 1, 0.5, 0.6],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 8 }}
      />
    </div>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isCreateHome = pathname === "/";
  const meta = pageMeta[pathname] ?? { title: "DreamOS86" };

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    // h-screen + overflow-hidden ensures only the content area scrolls,
    // not the entire page — sidebar and topbar remain perfectly fixed.
    <div className="relative flex h-screen overflow-hidden bg-background">
      <AmbientOrbs />
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Right column: topbar + scrollable content */}
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          mode={isCreateHome ? "create" : "standard"}
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setMobileOpen(true)}
        />

        {/* Only this scrolls — sidebar/topbar stay fixed */}
        <main
          className={
            isCreateHome
              ? "relative flex-1 overflow-y-auto overflow-x-hidden"
              : "relative flex-1 overflow-y-auto overflow-x-hidden bg-atmosphere px-[var(--page-padding-x)] py-[var(--page-padding-y)]"
          }
          style={{ scrollBehavior: "smooth" }}
        >
          {/*
            IMPORTANT: do NOT add `mode="wait"` here, and do NOT add a
            second AnimatePresence inside template.tsx. Two presences keyed
            by pathname produce intermittent white-screens in production
            (React 19 scheduler races the framer-motion exit commit).
            `popLayout` lets the next page mount immediately on top while
            the previous page fades out — never a blank frame.
          */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
